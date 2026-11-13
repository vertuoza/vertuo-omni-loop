-- A runner job lost by its runner is resumed (PRD 2809, docs: .omni-loop/delivery/inbox/2809-unlosable-jobs/spec.md,
-- section 1, "A resume is a new job row").
--
-- - runner_jobs.resumes: the job this one resumes, a job its runner lost. Unique: a lost job is resumed once,
--   so a second mark of the same loss queues nothing. Null for any other job, and once that job is deleted.
-- - runner_jobs.attempt: which attempt of its chain the job is, 1 to 3; 1 for every job already there and every
--   job a person, a key or the app sends. A resume is one more than the job it resumes.
-- - runner_jobs.resume_after: before it, runner_claim() hands the job to no runner. Null for any job but a
--   resume: 1 minute after the first loss, 5 minutes after the second, so a runner that was only silent comes
--   back, is refused, and saves its work before the resume starts.
-- - runner_job_resume_lost(), the trigger runner_jobs_resume_lost: a claimed or running job that ends `failed`
--   with one of the three reasons of a lost job (`runner lost`, which runners_mark_lost(), a runner registering
--   again and a claim never reported running write; `the worktree could not be made` and `the tmux session
--   could not be started`, which the runner reports) queues, in the same transaction, one resume: the same
--   line, repository, sender (the person, the app, or the key and its maker, BR-PRODUCT-125, whom the key acted
--   for and the link its changes are pinged to) and target (to_runner or to_fleet), `resumes` the lost job,
--   `attempt` one more, `resume_after` its wait. Only when the line's skill is a resumable one (the list below,
--   RESUMABLE_SKILLS in kit/lib/runner/line.ts, held to it by apps/galaxy/src/runners/runners.resume.migration.test.ts),
--   the attempt is under 3 and nobody asked to cancel the job. A cancel, a refusal (`github app: …`), the skill's
--   own failure, a timeout and any other reason queue nothing; the third loss queues nothing.
-- - runner_claim(runner, registered_at): as 20270108090000_runner_registration.sql, and it hands out no job
--   before its resume_after.
--
-- Returned columns: runner_claim() returns runner_jobs rows, so it carries the three new columns, which
-- apps/galaxy/src/runners/runners.repository.ts reads. Nobody signed in writes runner_jobs, as before: the
-- trigger's function runs as its owner and nobody may call it.
--
-- Laws kept: no membership, ask session, AI key, agent link, answer or ledger row is read or written
-- (BR-PRODUCT-12, 28, 29, 39, 59, 63, 64, N-PRODUCT-16); a resume merges nothing a person did not (N-PRODUCT-15).
--
-- Proven by supabase/checks/runner_resume.sql.
-- Rollback: a follow-up migration restores runner_claim(uuid, timestamptz) as 20270108090000 has it, drops the
-- trigger and its function, then the three columns. Until then a job that is never lost reads attempt 1 and
-- is claimed exactly as before.

alter table public.runner_jobs
  add column resumes      uuid unique references public.runner_jobs (id) on delete set null,
  add column attempt      smallint not null default 1 check (attempt between 1 and 3),
  add column resume_after timestamptz,
  add constraint runner_jobs_resume_shape check (resumes is null or attempt > 1);

comment on column public.runner_jobs.resumes is
  'The job this one resumes (PRD 2809): a job its runner lost. Unique: a lost job is resumed once. Null for any other job, and once that job is deleted.';
comment on column public.runner_jobs.attempt is
  'Which attempt of its chain the job is (PRD 2809), 1 to 3: 1 for a job someone sent, one more than the job it resumes for a resume.';
comment on column public.runner_jobs.resume_after is
  'Before it, no runner claims the job (PRD 2809): 1 minute after the first loss of its chain, 5 minutes after the second. Null for any job but a resume.';

-- ── A lost job queues its resume ─────────────────────────────────────────────────

create function public.runner_job_resume_lost() returns trigger
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
  insert into public.runner_jobs (workspace_id, line, repo, to_runner, to_fleet, sent_by, sent_by_app, sent_by_key, acting_for, notify_url, resumes, attempt, resume_after)
  values (new.workspace_id, new.line, new.repo, new.to_runner, new.to_fleet, new.sent_by, new.sent_by_app, new.sent_by_key, new.acting_for, new.notify_url,
          new.id, new.attempt + 1, now() + case when new.attempt = 1 then interval '1 minute' else interval '5 minutes' end)
  on conflict (resumes) do nothing;
  return null;
end;
$$;

revoke execute on function public.runner_job_resume_lost() from public, anon, authenticated, service_role;

create trigger runner_jobs_resume_lost
  after update of status on public.runner_jobs
  for each row when (
    new.status = 'failed' and old.status in ('claimed', 'running')
    and new.reason in ('runner lost', 'the worktree could not be made', 'the tmux session could not be started')
  )
  execute function public.runner_job_resume_lost();

-- ── The claim waits for a resume's wait ──────────────────────────────────────────

-- As 20270108090000_runner_registration.sql, and a job whose resume_after is still to come is handed to no
-- runner. Returned columns: runner_jobs', the three new ones included.
create or replace function public.runner_claim(p_runner uuid, p_registered_at timestamptz default null) returns setof public.runner_jobs
language plpgsql
set search_path = ''
as $$
declare
  r    public.runners;
  busy integer;
begin
  select * into r from public.runners where id = p_runner for update;
  if r.id is null or not r.github_app or (p_registered_at is not null and r.registered_at <> p_registered_at) then
    return;
  end if;
  select count(*) into busy from public.runner_jobs j where j.runner_id = r.id and j.status in ('claimed', 'running');
  if busy >= r.slots then
    return;
  end if;
  return query
  update public.runner_jobs j
     set status = 'claimed', runner_id = r.id, claimed_at = now()
   where j.id = (
     select q.id from public.runner_jobs q
      where q.workspace_id = r.workspace_id
        and q.status = 'queued'
        and not q.cancel_requested
        and (q.resume_after is null or q.resume_after <= now())
        and q.repo = any (r.repos)
        and (q.to_runner = r.id
             or (q.to_runner is null and q.to_fleet is not null and q.to_fleet = r.fleet)
             or (q.to_runner is null and q.to_fleet is null and r.fleet is null))
      order by q.queued_at, q.id
      limit 1
      for update skip locked)
     and j.status = 'queued'
  returning j.*;
end;
$$;

revoke execute on function public.runner_claim(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.runner_claim(uuid, timestamptz) to service_role;
