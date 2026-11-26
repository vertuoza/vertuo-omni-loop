-- Jobs expire after 48 h doing nothing (PRD omni-loop-35 s1, spec on the PRD's page, Solution A and the last line of
-- Solution B, criteria AC-1 to AC-5). It runs after 20270129190000_mission_own_fleet_approval.sql, and builds on
-- 20261207100000_runners.sql (runner_jobs, runners_mark_lost(), the sweep it mirrors), 20261218100000_runner_job_questions.sql
-- and 20261229090000_api_key_job_control.sql (runner_job_questions), 20261220090000_fix_when_answered.sql (continues),
-- 20270121100000_runner_resume.sql and 20270125120000_runner_limit_waits.sql (resume_after, the resume triggers),
-- 20270122093000_missions.sql (mission_id), 20270122122000_reviewer.sql (the outcome check) and
-- 20270129180000_supervisor.sql (supervisor_findings, supervisor_messages).
--
-- - runner_jobs.outcome: also accepts `expired`, a job that ended Held, Waiting on answers or Need human that nobody
--   continued for 48 h. Its status stays `done` (a job's status only moves forward, DC-PRODUCT-5).
-- - runner_jobs_claimed_shape: a `failed` job may hold no runner when no runner ever claimed it (claimed_at null): a
--   queued job the sweep ended. Every other shape reads as before.
-- - runner_jobs_expire(p_now): the whole sweep, in one transaction, safe to run twice; the App's ledger kind
--   `runner-jobs-expire` calls it every 15 minutes as the service role, the only role that may. EXPIRE_AFTER, 48 hours,
--   is the one constant below. It skips a job of a mission (mission_id set: the mission's own supervisor handles it,
--   P-PRODUCT-128) and a job whose cancel was asked.
--   - a queued job whose `max(queued_at, resume_after)` is 48 h or more before p_now ends `failed`, reason
--     `Expired: no runner took it in 48 h`. No resume follows: both resume triggers fire only on a claimed or running
--     job.
--   - a done job of outcome held, answers or human that ended 48 h or more before p_now and that no job continues takes
--     the outcome `expired`, reason `Expired: nobody continued it in 48 h`. Its questions nobody answered close first,
--     closed_at set, no answer and nobody who closed them (BR-PRODUCT-12: an answered round is never touched), so an
--     answer that comes after is refused as for any closed round, and one that came before has queued the
--     continuation that keeps the job out of the sweep.
--   - then supervisor_findings_group_per_job(p_now), below.
--   It answers the counts: {"failed": <queued jobs ended>, "expired": <waiting jobs expired>, "questions": <rounds
--   closed>, "grouped": <per-job findings closed>}.
-- - supervisor_findings_group_per_job(p_now): the open per-job findings of the two checks that now group by cause,
--   `stuck:queue:<job id>` and `stuck:waiting:<job id>` (never the group forms `stuck:queue-repo:<owner/repo>` and
--   `stuck:waiting:<held|answers|human>`), close as resolved, each with one line in its own thread, signed by no
--   person: `Grouped now: see the finding for <owner/repo>` or `… for the jobs <the wait>`. Run once below, when this
--   ships; each sweep runs it again, so a per-job finding an App from before this PRD raises while it deploys closes
--   too. Once nothing raises the per-job forms it closes nothing. Answers how many.
--
-- Nobody's grants change on a table: a member still reads the jobs, their rounds, the findings and their threads; only
-- the service role writes, here through the two functions, which run as their owner and nobody else may call.
--
-- Laws kept: an answer is never written or changed, only rounds nobody answered close (BR-PRODUCT-12); every row read
-- and written stays in its own job's workspace, a finding's line in its own workspace's thread (BR-PRODUCT-29,
-- BR-PRODUCT-63); no membership, ask session, AI key, agent link or ledger row is read or written (BR-PRODUCT-28, 39,
-- 59, 64, N-PRODUCT-16).
--
-- Every statement can run twice.
-- Proven by supabase/checks/runner_jobs_expire.sql.
-- Rollback: a follow-up migration drops runner_jobs_expire() and supervisor_findings_group_per_job(). Jobs it expired
-- stay expired, each with Send again; once no row holds `expired` as an outcome and no failed job lacks a runner, it can
-- restore runner_jobs_outcome_check of 20270122122000_reviewer.sql and runner_jobs_claimed_shape of
-- 20261207100000_runners.sql. Closed findings stay closed: a closed finding is never reopened.

-- ── A job's end: expired ───────────────────────────────────────────────────────

alter table public.runner_jobs drop constraint if exists runner_jobs_outcome_check;
alter table public.runner_jobs add constraint runner_jobs_outcome_check check (outcome in (
  'answers', 'held', 'ready', 'human', 'stopped',
  'pr-opened', 'already-fixed', 'needs-brainstorm', 'not-a-bug', 'stuck', 'blocked',
  'review', 'changes', 'expired'));

comment on column public.runner_jobs.outcome is
  'What a done job ended on: answers, held, ready or stopped (a yolo hand-off, PRDs 2223 and 2375), human (PRD 2255: it ended with its questions open), pr-opened, already-fixed, needs-brainstorm, not-a-bug, stuck or blocked (PRD 2425: a bug fix''s ending), review or changes (PRD 2871: the PR waits for the Reviewer, or the Reviewer asked for changes), or expired (PRD omni-loop-35: it ended answers, held or human and nobody continued it in 48 h). Null for any other job.';

-- ── A queued job the sweep ended holds no runner ────────────────────────────────

alter table public.runner_jobs drop constraint if exists runner_jobs_claimed_shape;
alter table public.runner_jobs add constraint runner_jobs_claimed_shape check (
  (status = 'queued') = (runner_id is null)
  or status = 'cancelled'
  or (status = 'failed' and runner_id is null and claimed_at is null));

-- ── The per-job findings close: grouped now ────────────────────────────────────

create or replace function public.supervisor_findings_group_per_job(p_now timestamptz) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  grouped integer;
begin
  if p_now is null then
    raise exception 'p_now: the sweep''s time is required.' using errcode = '22023', hint = 'p_now';
  end if;
  with closed as (
    update public.supervisor_findings f
       set state = 'resolved', closed_at = p_now
     where f.state = 'open'
       and f.fingerprint ~ '^stuck:(queue|waiting):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    returning f.id, f.workspace_id, f.fingerprint
  ), said as (
    insert into public.supervisor_messages (workspace_id, finding_id, kind, body, created_at)
    select c.workspace_id, c.id, 'supervisor',
           case
             when c.fingerprint like 'stuck:queue:%' and j.repo is not null
               then 'Grouped now: see the finding for ' || j.repo || ', one for the jobs queued there.'
             when c.fingerprint like 'stuck:queue:%'
               then 'Grouped now: one finding per repository takes the place of one per job.'
             when j.outcome = 'held' then 'Grouped now: see the finding for the jobs Held, one for them all.'
             when j.outcome = 'answers' then 'Grouped now: see the finding for the jobs Waiting on answers, one for them all.'
             when j.outcome = 'human' then 'Grouped now: see the finding for the jobs that Need human, one for them all.'
             else 'Grouped now: one finding per kind of wait takes the place of one per job.'
           end,
           p_now
      from closed c
      left join public.runner_jobs j
        on j.id = substring(c.fingerprint from '[0-9a-f-]{36}$')::uuid and j.workspace_id = c.workspace_id
    returning 1
  )
  select count(*) into grouped from said;
  return grouped;
end;
$$;

comment on function public.supervisor_findings_group_per_job(timestamptz) is
  'PRD omni-loop-35: closes as resolved the open per-job findings stuck:queue:<job> and stuck:waiting:<job>, each with a "Grouped now" line in its thread. Service role only; answers how many.';

revoke execute on function public.supervisor_findings_group_per_job(timestamptz) from public, anon, authenticated;
grant execute on function public.supervisor_findings_group_per_job(timestamptz) to service_role;

-- ── The sweep ───────────────────────────────────────────────────────────────────

create or replace function public.runner_jobs_expire(p_now timestamptz) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- EXPIRE_AFTER: the one delay of the rule, no setting (PRD omni-loop-35). The reasons below say it in words.
  expire_after constant interval := interval '48 hours';
  failed    integer;
  expired   integer;
  questions integer;
  grouped   integer;
  waiting   uuid[];
begin
  if p_now is null then
    raise exception 'p_now: the sweep''s time is required.' using errcode = '22023', hint = 'p_now';
  end if;

  -- A queued job no runner took in 48 h since it could first run ends failed. The update re-reads a row a runner
  -- claims meanwhile, which is then no longer queued and stays as the runner left it.
  update public.runner_jobs j
     set status = 'failed', reason = 'Expired: no runner took it in 48 h', ended_at = p_now
   where j.status = 'queued'
     and j.mission_id is null
     and not j.cancel_requested
     and greatest(j.queued_at, j.resume_after) <= p_now - expire_after;
  get diagnostics failed = row_count;

  -- A job that ended waiting on a person, that nobody continued in 48 h.
  select coalesce(array_agg(j.id), '{}') into waiting
    from public.runner_jobs j
   where j.status = 'done'
     and j.outcome in ('held', 'answers', 'human')
     and j.mission_id is null
     and not j.cancel_requested
     and j.ended_at <= p_now - expire_after
     and not exists (select 1 from public.runner_jobs c where c.continues = j.id);

  -- Its rounds nobody answered close first: an answer after this is refused, one before it queued the continuation.
  update public.runner_job_questions q
     set closed_at = p_now
   where q.job_id = any (waiting) and q.closed_at is null;
  get diagnostics questions = row_count;

  update public.runner_jobs j
     set outcome = 'expired', reason = 'Expired: nobody continued it in 48 h'
   where j.id = any (waiting)
     and j.status = 'done'
     and j.outcome in ('held', 'answers', 'human')
     and not j.cancel_requested
     and not exists (select 1 from public.runner_jobs c where c.continues = j.id);
  get diagnostics expired = row_count;

  grouped := public.supervisor_findings_group_per_job(p_now);

  return jsonb_build_object('failed', failed, 'expired', expired, 'questions', questions, 'grouped', grouped);
end;
$$;

comment on function public.runner_jobs_expire(timestamptz) is
  'PRD omni-loop-35: the 48-hour sweep, run by the App''s ledger kind runner-jobs-expire as the service role. A queued job idle 48 h ends failed; a job ended held, answers or human and not continued in 48 h takes the outcome expired, its open rounds closed; mission jobs and jobs whose cancel was asked are skipped. Safe to run twice; answers {failed, expired, questions, grouped}.';

revoke execute on function public.runner_jobs_expire(timestamptz) from public, anon, authenticated;
grant execute on function public.runner_jobs_expire(timestamptz) to service_role;

-- ── Once, when it ships ─────────────────────────────────────────────────────────

select public.supervisor_findings_group_per_job(now());
