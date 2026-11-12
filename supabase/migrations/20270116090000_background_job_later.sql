-- The ledger can wait and pace (PRD omni-loop-3 s1, spec "What the ledger gains"): a job may ask to run again
-- later, one job of a kind and lane runs at a time, each job carries its own tries, and the health reads a
-- schedule that stopped running.
--
-- - background_jobs.progress: a small JSON object a job keeps for its next run (a fleet board's look number),
--   never a token and never a person's words. Set by a `later`; `{}` until then.
-- - background_jobs.laters: how many times the job asked to run later since its tries were last reset, at most 20.
-- - background_jobs.lane: null, or the lane the job runs in. background_job_claim() never hands out a job while
--   another job of the same kind and lane is running, nor two of them in one claim.
-- - background_jobs.max_tries: the job's tries, 1 to 5, set when it is added (5 when not given). A retry, or a
--   claim that ran out, on its last try fails it, as the 5th did before.
-- - background_job_add(kind, key, subject, payload, lane, max_tries) and background_job_refresh(…, lane,
--   max_tries): the two new arguments are optional. A refresh sets the lane on every call; the tries only when
--   it adds the job.
-- - background_job_finish(…, progress): the outcome `later`, due at p_retry_at (required), its progress kept, its
--   try given back. The 21st `later` since the tries were reset is `failed` instead. Every other outcome is
--   unchanged. A job's progress and laters go back to `{}` and 0 wherever its tries go back to zero: a replay,
--   a refresh that requeues it, a finish or a lost claim on a job holding `again`.
-- - background_job_replay(): as before, its progress and laters reset too.
-- - background_jobs_health(kinds, periods): as before, plus `scheduled`, the count of the schedules given (a
--   kind and its period in seconds, from the App's code) whose kind has had no `done` job for three periods;
--   late when it is above zero. Called with no schedule, it answers as before with `scheduled` 0.
-- - Who: the service role alone, as for every other function of the ledger. The rows hold repository names,
--   pull request numbers, commits and a job's own counters, no person (L-GDPR-1); the forget of PRD 2676
--   deletes a job finished over 90 days ago with its attempts (L-GDPR-4).
--
-- Every change adds: four columns with their checks, one index, the outcome `later` in the attempts' check, and
-- new bodies for the six functions it names. background_job_add(), background_job_refresh(),
-- background_job_finish() and background_jobs_health() gain arguments, so their old signatures are dropped and
-- the new ones granted as the old ones were. No row is changed: every job is in no lane, with 5 tries.
--
-- Proven by supabase/checks/background_jobs.sql.
--
-- Rollback (the down script): a follow-up migration that restores the six functions as
-- 20270113090000_background_jobs.sql and 20270114090000_pr_check_jobs.sql wrote them, under their old
-- signatures and grants, then drops the index, the four columns and `later` from the attempts' check (after
-- deleting the attempt lines whose outcome is `later`). Revert the App's callers first.

-- ── The columns ──────────────────────────────────────────────────────────────────

alter table public.background_jobs
  add column progress jsonb not null default '{}'::jsonb,
  add column laters integer not null default 0,
  add column lane text,
  add column max_tries integer not null default 5,
  add constraint background_jobs_progress_check check (jsonb_typeof(progress) = 'object' and char_length(progress::text) <= 4096),
  add constraint background_jobs_laters_check check (laters between 0 and 20),
  add constraint background_jobs_lane_check check (lane is null or char_length(lane) between 1 and 512),
  add constraint background_jobs_max_tries_check check (max_tries between 1 and 5);

-- One running job per kind and lane: what background_job_claim() keeps, held by the database too.
create unique index background_jobs_lane_running on public.background_jobs (kind, lane) where state = 'running' and lane is not null;

comment on column public.background_jobs.progress is
  'PRD omni-loop-3: what the job keeps for its next run, set by a `later`; a small JSON object, never a token nor a person''s words.';
comment on column public.background_jobs.laters is
  'PRD omni-loop-3: how many times the job asked to run later since its tries were last reset; a 21st fails it.';
comment on column public.background_jobs.lane is
  'PRD omni-loop-3: null, or the lane the job runs in: never two running jobs of one kind and lane.';
comment on column public.background_jobs.max_tries is
  'PRD omni-loop-3: the job''s tries, 1 to 5, set when it is added: its last try that throws or runs out fails it.';

alter table public.background_job_attempts
  drop constraint background_job_attempts_outcome_check,
  add constraint background_job_attempts_outcome_check
    check (outcome in ('done', 'skipped', 'retry', 'waiting', 'later', 'failed', 'lost'));

comment on column public.background_job_attempts.outcome is
  'done, skipped, retry, waiting (GitHub''s budget, the try given back), later (the job asked to run again at a date, the try given back), failed, or lost (the claim ran out).';

-- ── Adding a job: its lane and its tries ─────────────────────────────────────────

drop function public.background_job_add(text, text, text, jsonb);

-- Adds a job of p_kind under p_key, due now, in lane p_lane (null: none) with p_max_tries tries (null: 5);
-- nothing for a key the kind already holds. Answers whether it added one. 22023 a malformed value, its field
-- first in the message and in `hint`.
create function public.background_job_add(p_kind text, p_key text, p_subject text, p_payload jsonb,
                                           p_lane text default null, p_max_tries integer default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind    text := btrim(coalesce(p_kind, ''));
  v_key     text := btrim(coalesce(p_key, ''));
  v_subject text := lower(btrim(coalesce(p_subject, '')));
  v_lane    text := nullif(btrim(coalesce(p_lane, '')), '');
  v_tries   integer := coalesce(p_max_tries, 5);
  added     uuid;
begin
  if v_kind !~ '^[a-z][a-z0-9-]{0,62}$' then
    raise exception 'Kind: lower-case words joined by dashes.' using errcode = '22023', hint = 'kind';
  end if;
  if char_length(v_key) not between 1 and 512 then
    raise exception 'Key: between 1 and 512 characters.' using errcode = '22023', hint = 'key';
  end if;
  if char_length(v_subject) not between 1 and 512 then
    raise exception 'Subject: between 1 and 512 characters.' using errcode = '22023', hint = 'subject';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Payload: a JSON object.' using errcode = '22023', hint = 'payload';
  end if;
  if char_length(v_lane) > 512 then
    raise exception 'Lane: at most 512 characters.' using errcode = '22023', hint = 'lane';
  end if;
  if v_tries not between 1 and 5 then
    raise exception 'Max tries: between 1 and 5.' using errcode = '22023', hint = 'max_tries';
  end if;
  insert into public.background_jobs (kind, key, subject, payload, lane, max_tries)
  values (v_kind, v_key, v_subject, p_payload, v_lane, v_tries)
  on conflict (kind, key) do nothing
  returning id into added;
  return added is not null;
end;
$$;

-- ── Refreshing a job: its lane on every call, its tries when it adds it ──────────

drop function public.background_job_refresh(text, text, text, jsonb, integer);

-- As 20270114090000_pr_check_jobs.sql wrote it, with p_lane set on the job by every call, and p_max_tries (null:
-- 5) when the call adds it. A refresh that requeues a finished job, or holds `again` on a running one, resets
-- its progress and laters with its tries (the `again` ones at its finish).
create function public.background_job_refresh(p_kind text, p_key text, p_subject text, p_payload jsonb, p_delay_seconds integer,
                                               p_lane text default null, p_max_tries integer default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind    text := btrim(coalesce(p_kind, ''));
  v_key     text := btrim(coalesce(p_key, ''));
  v_subject text := lower(btrim(coalesce(p_subject, '')));
  v_lane    text := nullif(btrim(coalesce(p_lane, '')), '');
  v_tries   integer := coalesce(p_max_tries, 5);
  v_due     timestamptz;
  added     uuid;
  job       public.background_jobs;
begin
  if v_kind !~ '^[a-z][a-z0-9-]{0,62}$' then
    raise exception 'Kind: lower-case words joined by dashes.' using errcode = '22023', hint = 'kind';
  end if;
  if char_length(v_key) not between 1 and 512 then
    raise exception 'Key: between 1 and 512 characters.' using errcode = '22023', hint = 'key';
  end if;
  if char_length(v_subject) not between 1 and 512 then
    raise exception 'Subject: between 1 and 512 characters.' using errcode = '22023', hint = 'subject';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Payload: a JSON object.' using errcode = '22023', hint = 'payload';
  end if;
  if p_delay_seconds is null or p_delay_seconds not between 0 and 3600 then
    raise exception 'Delay: between 0 and 3600 seconds.' using errcode = '22023', hint = 'delay_seconds';
  end if;
  if char_length(v_lane) > 512 then
    raise exception 'Lane: at most 512 characters.' using errcode = '22023', hint = 'lane';
  end if;
  if v_tries not between 1 and 5 then
    raise exception 'Max tries: between 1 and 5.' using errcode = '22023', hint = 'max_tries';
  end if;
  v_due := now() + make_interval(secs => p_delay_seconds);

  for turn in 1..3 loop
    insert into public.background_jobs (kind, key, subject, payload, run_after, lane, max_tries)
    values (v_kind, v_key, v_subject, p_payload, v_due, v_lane, v_tries)
    on conflict (kind, key) do nothing
    returning id into added;
    if added is not null then
      return 'added';
    end if;
    select * into job from public.background_jobs j where j.kind = v_kind and j.key = v_key for update;
    exit when found;
  end loop;
  if job.id is null then
    raise exception 'Job: % % could not be held.', v_kind, v_key using errcode = '40001', hint = 'key';
  end if;

  if job.state = 'queued' then
    update public.background_jobs j set payload = p_payload, run_after = v_due, lane = v_lane where j.id = job.id;
    return 'updated';
  end if;
  if job.state = 'running' then
    -- The lane of a running job stays until its finish: one running job per kind and lane holds meanwhile.
    update public.background_jobs j set payload = p_payload, again = true where j.id = job.id;
    return 'again';
  end if;
  update public.background_jobs j
     set state = 'queued', payload = p_payload, tries = 0, laters = 0, progress = '{}'::jsonb, run_after = v_due,
         reason = null, finished_at = null, lane = v_lane
   where j.id = job.id;
  return 'requeued';
end;
$$;

-- ── Claiming the jobs due: one per kind and lane, each with its own tries ────────

-- As 20270114090000_pr_check_jobs.sql wrote it, but a claim that ran out fails the job on its own last try
-- (max_tries, not 5), and the jobs due are handed out one by one, oldest first, skipping a job in a lane whose
-- kind already runs a job there, or took one in this claim. A lane is held for the claim by a transaction lock
-- before it is read, so two claims at once never both take a job of one kind and lane: the second skips it.
create or replace function public.background_job_claim(p_limit integer, p_lease_seconds integer) returns setof public.background_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  lost  public.background_jobs;
  due   public.background_jobs;
  taken public.background_jobs;
  n     integer := 0;
begin
  if p_limit is null or p_limit not between 1 and 100 then
    raise exception 'Limit: between 1 and 100 jobs.' using errcode = '22023', hint = 'limit';
  end if;
  if p_lease_seconds is null or p_lease_seconds not between 10 and 3600 then
    raise exception 'Lease: between 10 and 3600 seconds.' using errcode = '22023', hint = 'lease_seconds';
  end if;

  for lost in
    select * from public.background_jobs j
     where j.state = 'running' and j.claimed_until < now()
     order by j.claimed_until, j.id
     for update skip locked
  loop
    insert into public.background_job_attempts (job_id, try, started_at, ended_at, outcome, error)
    values (lost.id, lost.tries, lost.claimed_at, now(), 'lost', 'its claim ran out before it finished');
    update public.background_jobs j
       set state         = case when lost.tries >= lost.max_tries and not lost.again then 'failed' else 'queued' end,
           tries         = case when lost.again then 0 else j.tries end,
           laters        = case when lost.again then 0 else j.laters end,
           progress      = case when lost.again then '{}'::jsonb else j.progress end,
           run_after     = now(),
           reason        = case when lost.tries >= lost.max_tries and not lost.again then 'its claim ran out on its last try' end,
           finished_at   = case when lost.tries >= lost.max_tries and not lost.again then now() end,
           again         = false,
           claim         = null,
           claimed_at    = null,
           claimed_until = null
     where j.id = lost.id;
  end loop;

  for due in
    select * from public.background_jobs d
     where d.state = 'queued' and d.run_after <= now()
     order by d.run_after, d.created_at, d.id
     for update skip locked
  loop
    if due.lane is not null then
      -- Held until this claim commits; a lane another claim holds is skipped, never waited for.
      continue when not pg_try_advisory_xact_lock(hashtextextended('background_jobs lane ' || due.kind || ' ' || due.lane, 0));
      continue when exists (select 1 from public.background_jobs r
                             where r.kind = due.kind and r.lane = due.lane and r.state = 'running');
    end if;
    update public.background_jobs j
       set state         = 'running',
           tries         = j.tries + 1,
           claim         = gen_random_uuid(),
           claimed_at    = now(),
           claimed_until = now() + make_interval(secs => p_lease_seconds)
     where j.id = due.id
    returning j.* into taken;
    n := n + 1;
    return next taken;
    exit when n >= p_limit;
  end loop;
end;
$$;

-- ── Finishing a try: `later` ─────────────────────────────────────────────────────

drop function public.background_job_finish(uuid, uuid, text, text, timestamptz);

-- Records the try of job p_id held under p_claim, and moves the job:
--   done      done
--   skipped   skipped, p_reason saying why (required)
--   retry     queued again at p_retry_at (required), the error in p_reason; failed instead on its last try
--   waiting   queued again at p_retry_at (required), its try given back: GitHub's budget was low
--   later     queued again at p_retry_at (required), its try given back, p_progress (a JSON object, `{}` when
--             null) kept for its next run; failed instead when it already asked 20 times
--   failed    failed, p_reason the error (required)
-- A try of a job holding `again` keeps its line, then queues the job at once, its tries, laters and progress
-- reset (PRD 2688). Answers the job's state. 22023 a malformed value, P0002 no such job, 55000 a claim that is
-- no longer the job's.
create function public.background_job_finish(p_id uuid, p_claim uuid, p_outcome text, p_reason text default null,
                                              p_retry_at timestamptz default null, p_progress jsonb default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  job        public.background_jobs;
  v_outcome  text := p_outcome;
  v_reason   text := public.background_job_line(p_reason);
  v_progress jsonb := coalesce(p_progress, '{}'::jsonb);
  v_state    text;
begin
  if v_outcome is null or v_outcome not in ('done', 'skipped', 'retry', 'waiting', 'later', 'failed') then
    raise exception 'Outcome: done, skipped, retry, waiting, later or failed.' using errcode = '22023', hint = 'outcome';
  end if;
  if v_outcome in ('skipped', 'failed') and v_reason is null then
    raise exception 'Reason: why the job is %.', v_outcome using errcode = '22023', hint = 'reason';
  end if;
  if v_outcome in ('retry', 'waiting', 'later') and p_retry_at is null then
    raise exception 'Retry at: when the job may run again.' using errcode = '22023', hint = 'retry_at';
  end if;
  if jsonb_typeof(v_progress) <> 'object' or char_length(v_progress::text) > 4096 then
    raise exception 'Progress: a JSON object of at most 4096 characters.' using errcode = '22023', hint = 'progress';
  end if;

  select * into job from public.background_jobs j where j.id = p_id for update;
  if not found then
    raise exception 'Job: % does not exist.', p_id using errcode = 'P0002', hint = 'id';
  end if;
  if job.state <> 'running' or p_claim is null or job.claim is distinct from p_claim then
    raise exception 'Claim: job % is no longer held by this claim.', p_id using errcode = '55000', hint = 'claim';
  end if;

  if v_outcome = 'retry' and job.tries >= job.max_tries then
    v_outcome := 'failed';
  end if;
  if v_outcome = 'later' and job.laters >= 20 then
    v_outcome := 'failed';
    v_reason := coalesce(v_reason, 'it asked to run later more than 20 times');
  end if;
  if v_outcome = 'failed' and v_reason is null then
    v_reason := 'it failed on its last try';
  end if;

  insert into public.background_job_attempts (job_id, try, started_at, ended_at, outcome, error)
  values (job.id, job.tries, job.claimed_at, now(), v_outcome, case when v_outcome in ('done', 'later') then null else v_reason end);

  if job.again then
    update public.background_jobs j
       set state         = 'queued',
           tries         = 0,
           laters        = 0,
           progress      = '{}'::jsonb,
           run_after     = now(),
           reason        = null,
           finished_at   = null,
           again         = false,
           claim         = null,
           claimed_at    = null,
           claimed_until = null
     where j.id = job.id;
    return 'queued';
  end if;

  v_state := case v_outcome when 'retry' then 'queued' when 'waiting' then 'queued' when 'later' then 'queued' else v_outcome end;
  update public.background_jobs j
     set state         = v_state,
         tries         = case when v_outcome in ('waiting', 'later') then greatest(j.tries - 1, 0) else j.tries end,
         laters        = case when v_outcome = 'later' then j.laters + 1 else j.laters end,
         progress      = case when v_outcome = 'later' then v_progress else j.progress end,
         run_after     = case when v_state = 'queued' then p_retry_at else j.run_after end,
         reason        = case when v_state in ('skipped', 'failed') then v_reason end,
         finished_at   = case when v_state = 'queued' then null else now() end,
         claim         = null,
         claimed_at    = null,
         claimed_until = null
   where j.id = job.id;
  return v_state;
end;
$$;

-- ── Replaying a failed job: its progress and laters reset too ────────────────────

create or replace function public.background_job_replay(p_id uuid) returns public.background_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  job public.background_jobs;
begin
  select * into job from public.background_jobs j where j.id = p_id for update;
  if not found then
    raise exception 'Job: % does not exist.', p_id using errcode = 'P0002', hint = 'id';
  end if;
  if job.state <> 'failed' then
    raise exception 'Job: % is %, not failed.', p_id, job.state using errcode = '55000', hint = 'state';
  end if;
  update public.background_jobs j
     set state = 'queued', tries = 0, laters = 0, progress = '{}'::jsonb, run_after = now(), reason = null, finished_at = null
   where j.id = job.id
  returning * into job;
  return job;
end;
$$;

-- ── Is it jammed? A schedule that stopped running ────────────────────────────────

drop function public.background_jobs_health();

-- {state: ok | late, late: <jobs due for over an hour>, failed: <failed jobs with no later done job of the same
-- kind and subject>, scheduled: <schedules whose kind has had no done job for three periods>}; late when any
-- count is above zero. p_kinds and p_periods are the App's schedules, a kind and its period in seconds at the
-- same place; a kind with no period, or a period not above zero, is not counted. Counts only: no repository, no
-- error. A claim that ran out over an hour ago counts as due.
create function public.background_jobs_health(p_kinds text[] default '{}', p_periods integer[] default '{}') returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with schedules as (
    select s.kind, s.period
      from unnest(coalesce(p_kinds, '{}'::text[]), coalesce(p_periods, '{}'::integer[])) as s (kind, period)
     where s.kind is not null and s.period > 0
  ),
  counts as (
    select
      (select count(*) from public.background_jobs j
        where (j.state = 'queued' and j.run_after < now() - interval '1 hour')
           or (j.state = 'running' and j.claimed_until < now() - interval '1 hour'))::integer as late,
      (select count(*) from public.background_jobs f
        where f.state = 'failed'
          and not exists (select 1 from public.background_jobs d
                           where d.state = 'done' and d.kind = f.kind and d.subject = f.subject
                             and d.finished_at > f.finished_at))::integer as failed,
      (select count(*) from schedules s
        where not exists (select 1 from public.background_jobs d
                           where d.state = 'done' and d.kind = s.kind
                             and d.finished_at > now() - make_interval(secs => 3 * s.period)))::integer as scheduled
  )
  select jsonb_build_object('state', case when c.late > 0 or c.failed > 0 or c.scheduled > 0 then 'late' else 'ok' end,
                            'late', c.late, 'failed', c.failed, 'scheduled', c.scheduled)
    from counts c;
$$;

-- ── Who may call them ────────────────────────────────────────────────────────────

revoke execute on function public.background_job_add(text, text, text, jsonb, text, integer) from public, anon, authenticated;
grant execute on function public.background_job_add(text, text, text, jsonb, text, integer) to service_role;
revoke execute on function public.background_job_refresh(text, text, text, jsonb, integer, text, integer) from public, anon, authenticated;
grant execute on function public.background_job_refresh(text, text, text, jsonb, integer, text, integer) to service_role;
revoke execute on function public.background_job_finish(uuid, uuid, text, text, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.background_job_finish(uuid, uuid, text, text, timestamptz, jsonb) to service_role;
revoke execute on function public.background_jobs_health(text[], integer[]) from public, anon, authenticated;
grant execute on function public.background_jobs_health(text[], integer[]) to service_role;
