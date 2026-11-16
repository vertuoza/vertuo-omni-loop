-- A runner job that meets a provider limit waits instead of failing (PRD 2949, s1, docs:
-- .omni-loop/delivery/inbox/2949-limit-waits/spec.md, sections 1 and 2).
--
-- - runner_jobs.limited_until: when the provider limit a job met is over, the earliest reset among its runner's accounts.
--   The report route writes it with a `failed` report that carries `limit` (or, from a runner older than PRD 2949, a
--   reason reading `no tokens left: every account is out until <ISO>`). Null for every other job.
-- - runner_jobs.waits: how many provider limits its chain has waited out, 0 to 6; 0 for every job already there and
--   every job a person, a key or the app sends. A limit's resume is one more than the job it resumes; a lost job's
--   resume keeps its count.
-- - runner_jobs_resume_shape: a resume is one attempt on (a lost job's, PRD 2809) or one wait on (a limit's), so a
--   resume may keep attempt 1 once waits grew.
-- - runner_job_resume_lost(): as 20270121100000_runner_resume.sql, and the resume carries the lost job's waits.
-- - runner_job_resume_limited(), the trigger runner_jobs_resume_limited: a claimed or running job that ends `failed`
--   with limited_until set queues, in the same transaction, one resume: the same line, repository, sender and target,
--   `resumes` the limited job, `attempt` kept (a limit spends no try), `waits` one more, `resume_after` its
--   limited_until. Every skill waits, a repository's own included. Nobody asked to cancel it; a cancel of the queued
--   resume ends it at once, so no runner claims it (BR-PRODUCT-134).
-- - runner_job_limit_spent(), the trigger runner_jobs_limit_spent: the same ending on a job whose waits is already 6
--   queues nothing, and its reason becomes `waited 6 times for a provider limit (last until <HH:MM> UTC)`.
--
-- Returned columns: runner_claim() returns runner_jobs rows, so it carries the two new columns, which
-- apps/galaxy/src/runners/runners.repository.ts reads. Nobody signed in writes runner_jobs, as before: the triggers'
-- functions run as their owner and nobody may call them.
--
-- Laws kept: no membership, ask session, AI key, agent link, answer or ledger row is read or written
-- (BR-PRODUCT-12, 28, 29, 39, 59, 63, 64, N-PRODUCT-16); a resume merges nothing a person did not (N-PRODUCT-15).
--
-- Proven by supabase/checks/runner_resume.sql.
-- Rollback: a follow-up migration drops the two triggers and their functions, restores runner_job_resume_lost() as
-- 20270121100000_runner_resume.sql has it and runner_jobs_resume_shape as `resumes is null or attempt > 1` (after
-- deleting or failing every queued resume of attempt 1), then drops the two columns. A limited job then fails as
-- before PRD 2949.

alter table public.runner_jobs
  add column limited_until timestamptz,
  add column waits         smallint not null default 0 check (waits between 0 and 6),
  drop constraint runner_jobs_resume_shape,
  add constraint runner_jobs_resume_shape check (resumes is null or attempt > 1 or waits > 0);

comment on column public.runner_jobs.limited_until is
  'When the provider limit the job met is over (PRD 2949): the earliest reset among its runner''s accounts, set with a failed report. Null for any other job.';
comment on column public.runner_jobs.waits is
  'How many provider limits its chain waited out (PRD 2949), 0 to 6: 0 for a job someone sent, one more than the job it resumes for a limit''s resume.';

-- ── A lost job's resume keeps its chain's waits ──────────────────────────────────

-- As 20270121100000_runner_resume.sql, and the resume carries the lost job's waits.
create or replace function public.runner_job_resume_lost() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  skill text := substring(new.line from '^/omni:([a-z][a-z-]*)');
begin
  if new.attempt >= 3 or new.cancel_requested or skill is null
     or not (skill = any (array['yolo', 'yolo-fix', 'wave', 'do-work', 'pr-care', 'bug-fix'])) then
    return null;
  end if;
  insert into public.runner_jobs (workspace_id, line, repo, to_runner, to_fleet, sent_by, sent_by_app, sent_by_key, acting_for, notify_url, resumes, attempt, waits, resume_after)
  values (new.workspace_id, new.line, new.repo, new.to_runner, new.to_fleet, new.sent_by, new.sent_by_app, new.sent_by_key, new.acting_for, new.notify_url,
          new.id, new.attempt + 1, new.waits, now() + case when new.attempt = 1 then interval '1 minute' else interval '5 minutes' end)
  on conflict (resumes) do nothing;
  return null;
end;
$$;

revoke execute on function public.runner_job_resume_lost() from public, anon, authenticated, service_role;

-- ── A limited job queues its resume after the reset ──────────────────────────────

create function public.runner_job_resume_limited() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.cancel_requested then
    return null;
  end if;
  insert into public.runner_jobs (workspace_id, line, repo, to_runner, to_fleet, sent_by, sent_by_app, sent_by_key, acting_for, notify_url, resumes, attempt, waits, resume_after)
  values (new.workspace_id, new.line, new.repo, new.to_runner, new.to_fleet, new.sent_by, new.sent_by_app, new.sent_by_key, new.acting_for, new.notify_url,
          new.id, new.attempt, new.waits + 1, new.limited_until)
  on conflict (resumes) do nothing;
  return null;
end;
$$;

revoke execute on function public.runner_job_resume_limited() from public, anon, authenticated, service_role;

create trigger runner_jobs_resume_limited
  after update of status on public.runner_jobs
  for each row when (
    new.status = 'failed' and old.status in ('claimed', 'running')
    and new.limited_until is not null and new.waits < 6
  )
  execute function public.runner_job_resume_limited();

-- ── The seventh limit queues nothing and says why ───────────────────────────────

create function public.runner_job_limit_spent() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.reason := 'waited 6 times for a provider limit (last until ' || to_char(new.limited_until at time zone 'UTC', 'HH24:MI') || ' UTC)';
  return new;
end;
$$;

revoke execute on function public.runner_job_limit_spent() from public, anon, authenticated, service_role;

create trigger runner_jobs_limit_spent
  before update of status on public.runner_jobs
  for each row when (
    new.status = 'failed' and old.status in ('claimed', 'running')
    and new.limited_until is not null and new.waits >= 6
  )
  execute function public.runner_job_limit_spent();
