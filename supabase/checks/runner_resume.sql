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
-- online, to any runner once it is not, and a save past its keep date holds nothing back (s5).
-- A provider limit (PRD 2949, s1): a job sent anew has waited nothing; a wait outside 0 to 6 is refused, and so is a
-- resume that neither spends a try nor counts a wait; nobody signed in writes them. A claimed or running job of any
-- skill that ends `failed` with limited_until queues one resume at that time, with its line, repository, sender and
-- target, attempt unchanged and waits one more, its own reason kept; the seventh limit queues nothing and its reason
-- reads `waited 6 times for a provider limit (last until <HH:MM> UTC)`. A limited job whose cancel was asked queues
-- nothing, and a cancelled resume is never claimed (BR-PRODUCT-134). A lost runner still spends a try and keeps the
-- chain's waits; `no tokens left` with no reset is a plain failure.
-- Recovery first (PRD 2949, s3): runner_claim() hands out every resume before any fresh job, a resume queued last first
-- when its chain began first, the chain followed back whole, and the runner's slots still bound it. A runner whose health,
-- under two minutes old, reports every account out until a time to come gets nothing; one whose health is older, or
-- lists an account ready, out until a time past, out with no reset or a reset that reads as no time, or no account at
-- all, gets a job. A long chain's local save, three jobs back, holds its resume for the runner that keeps it.
-- Any `FAIL:` stops the run.

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

-- ── A provider limit: the job waits for the reset, spending no try (PRD 2949, s1) ──
-- M1 /omni:plan 2950 (a skill no loss resumes: every skill waits), the key pipeline's for Jane D. with a link, to the fleet
-- cia: the chain of seven limits. M2 /omni:yolo 2951, Mo's, cancel asked, then limited. M3 /omni:yolo 2952, Mo's: limited, its
-- resume cancelled. M4 /omni:yolo 2953: limited, then its resume lost. M5 /omni:wave 2954, claimed: the account cap's limit.
-- M6 /omni:yolo 2955 fails `no tokens left` with no reset. All on box-cia.
insert into public.runner_jobs (id, workspace_id, line, repo, to_runner, to_fleet, sent_by, sent_by_key, acting_for, notify_url, status, runner_id, claimed_at, running_at, queued_at) values
  ('00000000-0000-4000-8000-000002949201', '00000000-0000-4000-8000-000002809001', '/omni:plan 2950', 'resume-check/app', null, 'cia', '00000000-0000-4000-8000-0000028090a1', '00000000-0000-4000-8000-0000028093a1', 'Jane D.', 'https://hooks.resume.test/ping', 'running', '00000000-0000-4000-8000-0000028091c1', now() - interval '9 minutes', now() - interval '8 minutes', now() - interval '10 minutes'),
  ('00000000-0000-4000-8000-000002949202', '00000000-0000-4000-8000-000002809001', '/omni:yolo 2951', 'resume-check/app', null, null, '00000000-0000-4000-8000-0000028090b1', null, null, null, 'running', '00000000-0000-4000-8000-0000028091c1', now() - interval '9 minutes', now() - interval '8 minutes', now() - interval '10 minutes'),
  ('00000000-0000-4000-8000-000002949203', '00000000-0000-4000-8000-000002809001', '/omni:yolo 2952', 'resume-check/app', null, null, '00000000-0000-4000-8000-0000028090b1', null, null, null, 'running', '00000000-0000-4000-8000-0000028091c1', now() - interval '9 minutes', now() - interval '8 minutes', now() - interval '10 minutes'),
  ('00000000-0000-4000-8000-000002949204', '00000000-0000-4000-8000-000002809001', '/omni:yolo 2953', 'resume-check/app', null, null, '00000000-0000-4000-8000-0000028090b1', null, null, null, 'running', '00000000-0000-4000-8000-0000028091c1', now() - interval '9 minutes', now() - interval '8 minutes', now() - interval '10 minutes'),
  ('00000000-0000-4000-8000-000002949205', '00000000-0000-4000-8000-000002809001', '/omni:wave 2954', 'resume-check/app', null, null, '00000000-0000-4000-8000-0000028090b1', null, null, null, 'claimed', '00000000-0000-4000-8000-0000028091c1', now() - interval '9 minutes', null, now() - interval '10 minutes'),
  ('00000000-0000-4000-8000-000002949206', '00000000-0000-4000-8000-000002809001', '/omni:yolo 2955', 'resume-check/app', null, null, '00000000-0000-4000-8000-0000028090b1', null, null, null, 'running', '00000000-0000-4000-8000-0000028091c1', now() - interval '9 minutes', now() - interval '8 minutes', now() - interval '10 minutes');

-- The columns' rules: a job sent anew has waited nothing and met no limit; a wait outside 0 to 6, and a resume that neither
-- spends a try nor counts a wait, are refused; nobody signed in writes them.
do $$
declare
  got public.runner_jobs;
begin
  select * into got from public.runner_jobs where id = '00000000-0000-4000-8000-000002949201';
  if got.waits <> 0 or got.limited_until is not null then
    raise exception 'FAIL: a job sent anew reads waits %, limited_until %, not 0 and none', got.waits, got.limited_until;
  end if;
  begin
    update public.runner_jobs set waits = 7 where id = '00000000-0000-4000-8000-000002949206';
    raise exception 'FAIL: a seventh wait was stored';
  exception when check_violation then null; end;
  begin
    update public.runner_jobs set waits = -1 where id = '00000000-0000-4000-8000-000002949206';
    raise exception 'FAIL: a wait below 0 was stored';
  exception when check_violation then null; end;
  begin
    update public.runner_jobs set resumes = '00000000-0000-4000-8000-000002949205', waits = 0 where id = '00000000-0000-4000-8000-000002949206';
    raise exception 'FAIL: a first attempt that waited nothing was stored as a resume';
  exception when check_violation then null; end;
end $$;

set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000028090b1');
do $$
begin
  if (select waits from public.runner_jobs where id = '00000000-0000-4000-8000-000002949206') is distinct from 0::smallint then
    raise exception 'FAIL: a member did not read a job''s waits';
  end if;
  begin
    update public.runner_jobs set limited_until = now() where id = '00000000-0000-4000-8000-000002949206';
    raise exception 'FAIL: a member wrote a job''s limit';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

set local role service_role;

-- ── The first limit: one resume, at the reset, the same try, one wait more ──
do $$
declare
  limited constant uuid := '00000000-0000-4000-8000-000002949201';
  resume  public.runner_jobs;
  queued  integer;
begin
  update public.runner_jobs set status = 'failed', reason = 'no tokens left: every account is out until 2027-01-25T09:00:00.000Z',
         limited_until = '2027-01-25T09:00:00Z', ended_at = now() where id = limited;
  select * into resume from public.runner_jobs where resumes = limited;
  if resume.id is null then
    raise exception 'FAIL: the limited plan queued no resume: every skill waits for a limit';
  end if;
  if resume.status <> 'queued' or resume.attempt <> 1 or resume.waits <> 1 or resume.resume_after <> '2027-01-25T09:00:00Z'::timestamptz
     or resume.limited_until is not null or resume.line <> '/omni:plan 2950' or resume.repo <> 'resume-check/app'
     or resume.to_fleet is distinct from 'cia' or resume.to_runner is not null
     or resume.sent_by is distinct from '00000000-0000-4000-8000-0000028090a1' or resume.sent_by_key is distinct from '00000000-0000-4000-8000-0000028093a1'
     or resume.acting_for is distinct from 'Jane D.' or resume.notify_url is distinct from 'https://hooks.resume.test/ping' or resume.runner_id is not null then
    raise exception 'FAIL: the limit''s resume is %/attempt %/waits %/after %/% to %,% by %, key %: not the queued same try, one wait on, at the reset, of the same line, target and sender',
      resume.status, resume.attempt, resume.waits, resume.resume_after, resume.line, resume.to_runner, resume.to_fleet, resume.sent_by, resume.sent_by_key;
  end if;
  if (select reason from public.runner_jobs where id = limited) <> 'no tokens left: every account is out until 2027-01-25T09:00:00.000Z' then
    raise exception 'FAIL: a limit that queued its resume changed the job''s reason';
  end if;
  -- Marked again from running, its resume stays the one.
  update public.runner_jobs set status = 'running', ended_at = null where id = limited;
  update public.runner_jobs set status = 'failed', ended_at = now() where id = limited;
  select count(*) into queued from public.runner_jobs where resumes = limited;
  if queued <> 1 then
    raise exception 'FAIL: the same limit marked again left % resumes, not one', queued;
  end if;
end $$;

-- ── Six waits, then the seventh limit queues nothing and says why ──
do $$
declare
  job    uuid := (select id from public.runner_jobs where resumes = '00000000-0000-4000-8000-000002949201');
  ended  public.runner_jobs;
  next   uuid;
begin
  -- Waits 1 to 5 each meet the limit again and queue the next; the sixth wait meets the seventh limit, until 23:40.
  for n in 1..6 loop
    update public.runner_jobs set status = 'running', runner_id = '00000000-0000-4000-8000-0000028091c1', claimed_at = now(), running_at = now() where id = job;
    update public.runner_jobs set status = 'failed', reason = 'no tokens left: every account is out until ' || n, ended_at = now(),
           limited_until = '2027-01-25T23:40:00Z'::timestamptz + (n - 6) * interval '1 minute' where id = job;
    next := (select id from public.runner_jobs where resumes = job);
    if n < 6 and (next is null or (select waits from public.runner_jobs where id = next) <> n + 1 or (select attempt from public.runner_jobs where id = next) <> 1) then
      raise exception 'FAIL: wait % queued %, not one resume with waits % on the first try', n, next, n + 1;
    end if;
    exit when n = 6;
    job := next;
  end loop;
  if next is not null then
    raise exception 'FAIL: the seventh limit queued a resume: a job waits six times at most';
  end if;
  select * into ended from public.runner_jobs where id = job;
  if ended.status <> 'failed' or ended.waits <> 6 or ended.reason <> 'waited 6 times for a provider limit (last until 23:40 UTC)' then
    raise exception 'FAIL: the seventh limit ended %, waits %, %: not failed, waits 6, with why', ended.status, ended.waits, ended.reason;
  end if;
  if (select count(*) from public.runner_jobs where line = '/omni:plan 2950') <> 7 then
    raise exception 'FAIL: the chain holds % jobs, not the limited one and its six waits', (select count(*) from public.runner_jobs where line = '/omni:plan 2950');
  end if;
end $$;

-- ── A cancel: asked on the limited job, nothing waits; asked on its resume, no runner claims it ──
do $$
declare
  resume uuid;
  got    uuid;
begin
  update public.runner_jobs set cancel_requested = true where id = '00000000-0000-4000-8000-000002949202';
  update public.runner_jobs set status = 'failed', reason = 'no tokens left: every account is out until 2027-01-25T09:00:00.000Z',
         limited_until = now() - interval '1 second', ended_at = now() where id = '00000000-0000-4000-8000-000002949202';
  if exists (select 1 from public.runner_jobs where resumes = '00000000-0000-4000-8000-000002949202') then
    raise exception 'FAIL: a limited job whose cancel was asked queued a resume (BR-PRODUCT-134)';
  end if;

  update public.runner_jobs set status = 'failed', reason = 'no tokens left: every account is out until 2027-01-25T09:00:00.000Z',
         limited_until = now() - interval '1 second', ended_at = now() where id = '00000000-0000-4000-8000-000002949203';
  resume := (select id from public.runner_jobs where resumes = '00000000-0000-4000-8000-000002949203');
  -- As the Cancel route ends a queued job: at once. Its wait is over, yet no runner takes it.
  update public.runner_jobs set status = 'cancelled', cancel_requested = true, ended_at = now() where id = resume and status = 'queued';
  for n in 1..3 loop
    for got in select id from public.runner_claim('00000000-0000-4000-8000-0000028091a3') union all select id from public.runner_claim('00000000-0000-4000-8000-0000028091a1') loop
      if got = resume then
        raise exception 'FAIL: a runner claimed the limit''s resume after its cancel (BR-PRODUCT-134)';
      end if;
    end loop;
  end loop;
  if (select status from public.runner_jobs where id = resume) is distinct from 'cancelled' then
    raise exception 'FAIL: the cancelled resume reads %, not cancelled', (select status from public.runner_jobs where id = resume);
  end if;
end $$;

-- ── A lost runner still spends a try, and keeps the chain's waits ──
do $$
declare
  waited uuid;
  lost   public.runner_jobs;
begin
  update public.runner_jobs set status = 'failed', reason = 'no tokens left: every account is out until 2027-01-25T09:00:00.000Z',
         limited_until = now() - interval '1 second', ended_at = now() where id = '00000000-0000-4000-8000-000002949204';
  waited := (select id from public.runner_jobs where resumes = '00000000-0000-4000-8000-000002949204');
  update public.runner_jobs set status = 'running', runner_id = '00000000-0000-4000-8000-0000028091c1', claimed_at = now(), running_at = now() where id = waited;
  update public.runner_jobs set status = 'failed', reason = 'runner lost', ended_at = now() where id = waited;
  select * into lost from public.runner_jobs where resumes = waited;
  if lost.id is null or lost.attempt <> 2 or lost.waits <> 1 or lost.resume_after <> now() + interval '1 minute' then
    raise exception 'FAIL: the lost wait queued %, attempt %, waits %, % on: not attempt 2, still one wait, a minute on', lost.id, lost.attempt, lost.waits, lost.resume_after - now();
  end if;

  -- A claimed wave that changed account as often as it may: its limit waits as well.
  update public.runner_jobs set status = 'failed', reason = 'no tokens left: the job changed account 3 times, the most a job may',
         limited_until = now() + interval '1 hour', ended_at = now() where id = '00000000-0000-4000-8000-000002949205';
  waited := (select id from public.runner_jobs where resumes = '00000000-0000-4000-8000-000002949205');
  if waited is null or (select resume_after from public.runner_jobs where id = waited) <> now() + interval '1 hour' then
    raise exception 'FAIL: the account cap''s limit queued no resume at its reset';
  end if;
end $$;

-- ── `no tokens left` with no reset: a plain failure, as before ──
do $$
begin
  update public.runner_jobs set status = 'failed', reason = 'no tokens left: no account can take this job over', ended_at = now()
   where id = '00000000-0000-4000-8000-000002949206';
  if exists (select 1 from public.runner_jobs where resumes = '00000000-0000-4000-8000-000002949206') then
    raise exception 'FAIL: a failure with no reset queued a resume';
  end if;
end $$;

reset role;

-- ── Recovery first, never to a runner with every account out (PRD 2949, s3) ──
-- In the workspace Order, its own queue: o-1 (2 slots), o-2 and o-3 (8 each), no fleet, on order-check/app, all Olga's.
-- F1, a job sent anew three hours ago, and G1 to G5, sent anew since. Chain X: X1 queued five hours ago, then X2 to X4
-- (lost and limited, each queued within the last hour), and X5, its resume, queued a minute ago: five jobs, the first
-- four back. Chain Y: Y1 queued two and a half hours ago, and Y2, its resume, queued two hours ago.
insert into public.workspaces (id, slug, name, github_org) values
  ('00000000-0000-4000-8000-000002949003', 'order-check', 'Order', 'order-check');
insert into public.workspace_members (workspace_id, user_id, role) values
  ('00000000-0000-4000-8000-000002949003', '00000000-0000-4000-8000-0000028090a1', 'owner');
insert into public.runners (id, workspace_id, owner, name, fleet, slots, repos, github_app, last_seen_at) values
  ('00000000-0000-4000-8000-000002949301', '00000000-0000-4000-8000-000002949003', '00000000-0000-4000-8000-0000028090a1', 'o-1', null, 2, '{order-check/app}', true, now()),
  ('00000000-0000-4000-8000-000002949302', '00000000-0000-4000-8000-000002949003', '00000000-0000-4000-8000-0000028090a1', 'o-2', null, 8, '{order-check/app}', true, now()),
  ('00000000-0000-4000-8000-000002949303', '00000000-0000-4000-8000-000002949003', '00000000-0000-4000-8000-0000028090a1', 'o-3', null, 8, '{order-check/app}', true, now());
insert into public.runner_jobs (id, workspace_id, line, repo, sent_by, runner_id, status, reason, resumes, attempt, waits, limited_until, resume_after, queued_at, ended_at) values
  ('00000000-0000-4000-8000-000002949401', '00000000-0000-4000-8000-000002949003', '/omni:yolo 3001', 'order-check/app', '00000000-0000-4000-8000-0000028090a1', null, 'queued', null, null, 1, 0, null, null, now() - interval '3 hours', null),
  ('00000000-0000-4000-8000-000002949411', '00000000-0000-4000-8000-000002949003', '/omni:yolo 3011', 'order-check/app', '00000000-0000-4000-8000-0000028090a1', null, 'queued', null, null, 1, 0, null, null, now() - interval '170 minutes', null),
  ('00000000-0000-4000-8000-000002949412', '00000000-0000-4000-8000-000002949003', '/omni:yolo 3012', 'order-check/app', '00000000-0000-4000-8000-0000028090a1', null, 'queued', null, null, 1, 0, null, null, now() - interval '160 minutes', null),
  ('00000000-0000-4000-8000-000002949413', '00000000-0000-4000-8000-000002949003', '/omni:yolo 3013', 'order-check/app', '00000000-0000-4000-8000-0000028090a1', null, 'queued', null, null, 1, 0, null, null, now() - interval '150 minutes', null),
  ('00000000-0000-4000-8000-000002949414', '00000000-0000-4000-8000-000002949003', '/omni:yolo 3014', 'order-check/app', '00000000-0000-4000-8000-0000028090a1', null, 'queued', null, null, 1, 0, null, null, now() - interval '140 minutes', null),
  ('00000000-0000-4000-8000-000002949415', '00000000-0000-4000-8000-000002949003', '/omni:yolo 3015', 'order-check/app', '00000000-0000-4000-8000-0000028090a1', null, 'queued', null, null, 1, 0, null, null, now() - interval '130 minutes', null),
  ('00000000-0000-4000-8000-000002949421', '00000000-0000-4000-8000-000002949003', '/omni:wave 3002', 'order-check/app', '00000000-0000-4000-8000-0000028090a1', '00000000-0000-4000-8000-000002949303', 'failed', 'runner lost', null, 1, 0, null, null, now() - interval '5 hours', now() - interval '70 minutes'),
  ('00000000-0000-4000-8000-000002949422', '00000000-0000-4000-8000-000002949003', '/omni:wave 3002', 'order-check/app', '00000000-0000-4000-8000-0000028090a1', '00000000-0000-4000-8000-000002949303', 'failed', 'no tokens left', '00000000-0000-4000-8000-000002949421', 2, 0, now() - interval '50 minutes', now() - interval '69 minutes', now() - interval '60 minutes', now() - interval '55 minutes'),
  ('00000000-0000-4000-8000-000002949423', '00000000-0000-4000-8000-000002949003', '/omni:wave 3002', 'order-check/app', '00000000-0000-4000-8000-0000028090a1', '00000000-0000-4000-8000-000002949303', 'failed', 'no tokens left', '00000000-0000-4000-8000-000002949422', 2, 1, now() - interval '30 minutes', now() - interval '50 minutes', now() - interval '55 minutes', now() - interval '35 minutes'),
  ('00000000-0000-4000-8000-000002949424', '00000000-0000-4000-8000-000002949003', '/omni:wave 3002', 'order-check/app', '00000000-0000-4000-8000-0000028090a1', '00000000-0000-4000-8000-000002949303', 'failed', 'no tokens left', '00000000-0000-4000-8000-000002949423', 2, 2, now() - interval '2 minutes', now() - interval '30 minutes', now() - interval '35 minutes', now() - interval '5 minutes'),
  ('00000000-0000-4000-8000-000002949425', '00000000-0000-4000-8000-000002949003', '/omni:wave 3002', 'order-check/app', '00000000-0000-4000-8000-0000028090a1', null, 'queued', null, '00000000-0000-4000-8000-000002949424', 2, 3, null, now() - interval '2 minutes', now() - interval '1 minute', null),
  ('00000000-0000-4000-8000-000002949431', '00000000-0000-4000-8000-000002949003', '/omni:yolo 3003', 'order-check/app', '00000000-0000-4000-8000-0000028090a1', '00000000-0000-4000-8000-000002949303', 'failed', 'runner lost', null, 1, 0, null, null, now() - interval '150 minutes', now() - interval '125 minutes'),
  ('00000000-0000-4000-8000-000002949432', '00000000-0000-4000-8000-000002949003', '/omni:yolo 3003', 'order-check/app', '00000000-0000-4000-8000-0000028090a1', null, 'queued', null, '00000000-0000-4000-8000-000002949431', 2, 0, null, now() - interval '119 minutes', now() - interval '2 hours', null);

set local role service_role;

-- Resumes before any fresh job, by their chain's first queued time, followed back the whole chain; the slots still bound it.
do $$
declare
  o1  constant uuid := '00000000-0000-4000-8000-000002949301';
  got uuid;
begin
  got := (select id from public.runner_claim(o1));
  if got is distinct from '00000000-0000-4000-8000-000002949425' then
    raise exception 'FAIL: o-1 claimed %, not X5, the resume whose chain began first (five hours ago, four jobs back), though queued last', got;
  end if;
  got := (select id from public.runner_claim(o1));
  if got is distinct from '00000000-0000-4000-8000-000002949432' then
    raise exception 'FAIL: o-1 claimed %, not Y2, the other resume, before F1, a job sent anew earlier', got;
  end if;
  if exists (select 1 from public.runner_claim(o1)) then
    raise exception 'FAIL: o-1, its two slots taken by the resumes, claimed a third job';
  end if;
end $$;

-- A runner whose health, under two minutes old, reports every account out until a time to come gets nothing; any other
-- runner is judged by its own pause, and gets a job.
do $$
declare
  o2     constant uuid := '00000000-0000-4000-8000-000002949302';
  got    uuid;
  out_1h constant jsonb := jsonb_build_object('id', 'max-1', 'agent', 'claude', 'state', 'out', 'resetsAt', to_char((now() + interval '1 hour') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
  out_2h constant jsonb := jsonb_build_object('id', 'max-2', 'agent', 'claude', 'state', 'out', 'resetsAt', to_char((now() + interval '2 hours') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
  fresh  constant text := to_char((now() - interval '15 seconds') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  update public.runners set health = jsonb_build_object('cpu', 3, 'at', fresh, 'accounts', jsonb_build_array(out_1h, out_2h)) where id = o2;
  if exists (select 1 from public.runner_claim(o2)) then
    raise exception 'FAIL: o-2, its fresh health reporting every account out, was handed a job';
  end if;

  -- The same report, three minutes old: judged by its own pause, it takes F1.
  update public.runners set health = jsonb_build_object('cpu', 3, 'at', to_char((now() - interval '3 minutes') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                                                        'accounts', jsonb_build_array(out_1h, out_2h)) where id = o2;
  got := (select id from public.runner_claim(o2));
  if got is distinct from '00000000-0000-4000-8000-000002949401' then
    raise exception 'FAIL: o-2, its health three minutes old, claimed %, not F1', got;
  end if;

  -- One account ready: a job.
  update public.runners set health = jsonb_build_object('at', fresh, 'accounts', jsonb_build_array(out_1h, jsonb_build_object('id', 'pro-1', 'agent', 'claude', 'state', 'ready'))) where id = o2;
  if (select id from public.runner_claim(o2)) is distinct from '00000000-0000-4000-8000-000002949411' then
    raise exception 'FAIL: o-2, one account ready, was not handed G1';
  end if;

  -- Every account out, one of them until a time already past: a job.
  update public.runners set health = jsonb_build_object('at', fresh, 'accounts', jsonb_build_array(out_1h,
         jsonb_build_object('id', 'max-2', 'agent', 'claude', 'state', 'out', 'resetsAt', to_char((now() - interval '1 minute') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))) where id = o2;
  if (select id from public.runner_claim(o2)) is distinct from '00000000-0000-4000-8000-000002949412' then
    raise exception 'FAIL: o-2, an account''s reset already past, was not handed G2';
  end if;

  -- Its only account out with no reset, then with a reset that reads as no time: a job each, and no error.
  update public.runners set health = jsonb_build_object('at', fresh, 'accounts', jsonb_build_array(
         jsonb_build_object('id', 'max-1', 'agent', 'claude', 'state', 'out'))) where id = o2;
  if (select id from public.runner_claim(o2)) is distinct from '00000000-0000-4000-8000-000002949413' then
    raise exception 'FAIL: o-2, its only account out with no reset, was not handed G3';
  end if;
  update public.runners set health = jsonb_build_object('at', fresh, 'accounts', jsonb_build_array(
         jsonb_build_object('id', 'max-1', 'agent', 'claude', 'state', 'out', 'resetsAt', 'soon'))) where id = o2;
  if (select id from public.runner_claim(o2)) is distinct from '00000000-0000-4000-8000-000002949414' then
    raise exception 'FAIL: o-2, its account''s reset reading as no time, was not handed G4';
  end if;

  -- A fresh health that lists no account: a job.
  update public.runners set health = jsonb_build_object('at', fresh, 'accounts', '[]'::jsonb) where id = o2;
  if (select id from public.runner_claim(o2)) is distinct from '00000000-0000-4000-8000-000002949415' then
    raise exception 'FAIL: o-2, its health listing no account, was not handed G5';
  end if;
end $$;

reset role;

-- A long chain's local save: Z1 left one on o-3's disk, and Z4, three jobs on, waits for o-3 while it is online. H1, a
-- job sent anew, waits too.
insert into public.runner_jobs (id, workspace_id, line, repo, sent_by, runner_id, status, reason, resumes, attempt, waits, resume_after, queued_at, ended_at) values
  ('00000000-0000-4000-8000-000002949441', '00000000-0000-4000-8000-000002949003', '/omni:wave 3004', 'order-check/app', '00000000-0000-4000-8000-0000028090a1', '00000000-0000-4000-8000-000002949303', 'failed', 'runner lost', null, 1, 0, null, now() - interval '4 hours', now() - interval '3 hours'),
  ('00000000-0000-4000-8000-000002949442', '00000000-0000-4000-8000-000002949003', '/omni:wave 3004', 'order-check/app', '00000000-0000-4000-8000-0000028090a1', '00000000-0000-4000-8000-000002949303', 'failed', 'no tokens left', '00000000-0000-4000-8000-000002949441', 2, 0, now() - interval '3 hours', now() - interval '3 hours', now() - interval '2 hours'),
  ('00000000-0000-4000-8000-000002949443', '00000000-0000-4000-8000-000002949003', '/omni:wave 3004', 'order-check/app', '00000000-0000-4000-8000-0000028090a1', '00000000-0000-4000-8000-000002949303', 'failed', 'no tokens left', '00000000-0000-4000-8000-000002949442', 2, 1, now() - interval '2 hours', now() - interval '2 hours', now() - interval '1 hour'),
  ('00000000-0000-4000-8000-000002949444', '00000000-0000-4000-8000-000002949003', '/omni:wave 3004', 'order-check/app', '00000000-0000-4000-8000-0000028090a1', null, 'queued', null, '00000000-0000-4000-8000-000002949443', 2, 2, now() - interval '1 second', now() - interval '1 hour', null),
  ('00000000-0000-4000-8000-000002949451', '00000000-0000-4000-8000-000002949003', '/omni:yolo 3005', 'order-check/app', '00000000-0000-4000-8000-0000028090a1', null, 'queued', null, null, 1, 0, null, now() - interval '5 hours', null);
insert into public.runner_checkpoints (job_id, workspace_id, runner_id, kind, manifest, bytes, keep_until) values
  ('00000000-0000-4000-8000-000002949441', '00000000-0000-4000-8000-000002949003', '00000000-0000-4000-8000-000002949303', 'local',
   '{"job": "00000000-0000-4000-8000-000002949441", "kind": "local"}', 4096, now() + interval '7 days');

set local role service_role;

do $$
declare
  got uuid;
begin
  -- o-2 is handed H1 and nothing more: Z4 waits for o-3, which keeps its chain's save three jobs back.
  got := (select id from public.runner_claim('00000000-0000-4000-8000-000002949302'));
  if got is distinct from '00000000-0000-4000-8000-000002949451' then
    raise exception 'FAIL: o-2 claimed %, not H1: a resume whose chain''s save, three jobs back, is on o-3''s disk went to another runner', got;
  end if;
  if exists (select 1 from public.runner_claim('00000000-0000-4000-8000-000002949302')) then
    raise exception 'FAIL: o-2 claimed Z4, whose chain''s local save o-3 keeps, while o-3 is online';
  end if;
  got := (select id from public.runner_claim('00000000-0000-4000-8000-000002949303'));
  if got is distinct from '00000000-0000-4000-8000-000002949444' then
    raise exception 'FAIL: o-3, which keeps the chain''s save, claimed %, not Z4', got;
  end if;
end $$;

reset role;

rollback;

select 'runner_resume: every check passed' as result;
