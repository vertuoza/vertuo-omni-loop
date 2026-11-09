-- The job ledger (PRD 2676 s1, docs: .omni-loop/delivery/inbox/2676-job-ledger/spec.md, "The ledger"): the
-- App's background work kept in the product's database, so a job a webhook started is not lost when GitHub does
-- not send it again, a function is killed in the middle of it or a deploy lands between two tries. Its first and
-- only job is the knowledge pack.
--
-- - background_jobs: one row per piece of work, unique per kind and key (`knowledge-pack`,
--   `<owner/name>@<commit>`). `state` is queued, running, done, skipped or failed. A claim is a fresh id each
--   time a worker takes the job, with when it was taken and when it runs out; null when nobody holds it.
-- - background_job_attempts: one line per try, written when the try ends and never changed: its number, when it
--   started and ended, its outcome (done, skipped, retry, waiting, failed or lost) and its error's first line.
-- - background_job_add(): adds a job, nothing for a key it holds; says whether it added one.
-- - background_job_claim(): first writes each claim that ran out as a `lost` try, the job due again (or failed
--   when that was its 5th try); then hands out the jobs due, oldest first, in one statement `for update skip
--   locked`, so two workers never hold the same job. A claim adds one to `tries`.
-- - background_job_finish(): records the try and moves the job; refuses (55000) a claim that is no longer the
--   job's, so a worker presumed dead cannot overwrite the one that replaced it. `waiting` (GitHub's budget is
--   low) gives the try back; a `retry` on the 5th try is `failed`.
-- - background_job_replay(): a failed job back to queued, its tries at zero; its attempts stay.
-- - background_jobs_health(): `ok` or `late`, with counts and no name: late when a job has been due for over an
--   hour, or a failed job has no later done job of the same kind and subject.
-- - background_jobs_forget(): deletes the jobs finished over 90 days ago, with their attempts (L-GDPR-4).
-- - Who: the service role alone reads the two tables and calls the six functions; nobody signed in, nor anon,
--   reads or calls any of it. The rows hold repository names and commits, no person (L-GDPR-1).
--
-- Every change adds: two tables, six functions and the helper background_job_line(), which nobody but their
-- owner calls. Nothing existing is changed or dropped.
--
-- Proven by supabase/checks/background_jobs.sql.
--
-- Rollback (the down script): a follow-up migration that drops the seven functions, then background_job_attempts
-- and background_jobs. Before the App adds a job (s2) nothing depends on them; after, revert the App first.

-- ── The jobs ─────────────────────────────────────────────────────────────────────

create table public.background_jobs (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null constraint background_jobs_kind_check check (kind ~ '^[a-z][a-z0-9-]{0,62}$'),
  key           text not null constraint background_jobs_key_check check (char_length(key) between 1 and 512),
  subject       text not null constraint background_jobs_subject_check check (char_length(subject) between 1 and 512 and subject = lower(subject)),
  payload       jsonb not null default '{}'::jsonb constraint background_jobs_payload_check check (jsonb_typeof(payload) = 'object'),
  state         text not null default 'queued'
                constraint background_jobs_state_check check (state in ('queued', 'running', 'done', 'skipped', 'failed')),
  tries         integer not null default 0 constraint background_jobs_tries_check check (tries between 0 and 5),
  run_after     timestamptz not null default now(),
  claim         uuid,
  claimed_at    timestamptz,
  claimed_until timestamptz,
  reason        text constraint background_jobs_reason_check check (char_length(reason) <= 500),
  created_at    timestamptz not null default now(),
  finished_at   timestamptz,
  constraint background_jobs_kind_key unique (kind, key),
  -- Held exactly while running.
  constraint background_jobs_claim_check check (
    (state = 'running') = (claim is not null and claimed_at is not null and claimed_until is not null)
    and (state = 'running' or (claim is null and claimed_at is null and claimed_until is null))),
  -- Finished exactly when done, skipped or failed.
  constraint background_jobs_finished_check check ((state in ('done', 'skipped', 'failed')) = (finished_at is not null))
);

-- What a claim reads: the jobs due, and the claims that ran out.
create index background_jobs_due on public.background_jobs (run_after, created_at) where state = 'queued';
create index background_jobs_held on public.background_jobs (claimed_until) where state = 'running';
-- What the health and the forgetting read.
create index background_jobs_finished on public.background_jobs (kind, subject, finished_at) where finished_at is not null;

comment on table public.background_jobs is
  'PRD 2676: the App''s background work, one row per job, unique per kind and key. Written only through the background_job_* functions; read by the service role alone.';
comment on column public.background_jobs.kind is 'What the job is: knowledge-pack.';
comment on column public.background_jobs.key is 'Unique per kind: <owner/name>@<commit> for a knowledge pack.';
comment on column public.background_jobs.subject is 'The repository, owner/name in lower case: what the health matches a later done job by.';
comment on column public.background_jobs.payload is 'What the job needs, a JSON object; never a token.';
comment on column public.background_jobs.tries is 'How many tries were started, at most 5; a try that waited on GitHub''s budget is given back.';
comment on column public.background_jobs.run_after is 'When the job may run next.';
comment on column public.background_jobs.claim is 'A fresh id for each claim; null when nobody holds the job.';
comment on column public.background_jobs.claimed_at is 'When the claim was taken: the start of the try it writes.';
comment on column public.background_jobs.claimed_until is 'When the claim runs out: after it, the try is lost and the job due again.';
comment on column public.background_jobs.reason is 'Why the job is skipped or failed, in plain words, one line.';

create table public.background_job_attempts (
  id         bigint generated always as identity primary key,
  job_id     uuid not null references public.background_jobs (id) on delete cascade,
  try        integer not null constraint background_job_attempts_try_check check (try between 1 and 5),
  started_at timestamptz not null,
  ended_at   timestamptz not null,
  outcome    text not null
             constraint background_job_attempts_outcome_check check (outcome in ('done', 'skipped', 'retry', 'waiting', 'failed', 'lost')),
  error      text constraint background_job_attempts_error_check check (char_length(error) <= 500)
);

create index background_job_attempts_job on public.background_job_attempts (job_id, id);

comment on table public.background_job_attempts is
  'PRD 2676: one line per try of a background job, written when the try ends and never changed; deleted with its job.';
comment on column public.background_job_attempts.try is 'The try''s number: the job''s tries when it was claimed.';
comment on column public.background_job_attempts.outcome is 'done, skipped, retry, waiting (GitHub''s budget, the try given back), failed, or lost (the claim ran out).';
comment on column public.background_job_attempts.error is 'The first line of what went wrong, at most 500 characters; null when nothing did.';

-- A reason or an error as kept: its first line, trimmed and cut to 500 characters; null when empty.
create function public.background_job_line(p_text text) returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(left(btrim(split_part(coalesce(p_text, ''), E'\n', 1)), 500), '');
$$;

-- ── Adding a job ─────────────────────────────────────────────────────────────────

-- Adds a job of p_kind under p_key, due now; nothing for a key the kind already holds. Answers whether it added
-- one. 22023 a malformed value, its field first in the message and in `hint`.
create function public.background_job_add(p_kind text, p_key text, p_subject text, p_payload jsonb) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind    text := btrim(coalesce(p_kind, ''));
  v_key     text := btrim(coalesce(p_key, ''));
  v_subject text := lower(btrim(coalesce(p_subject, '')));
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
  insert into public.background_jobs (kind, key, subject, payload)
  values (v_kind, v_key, v_subject, p_payload)
  on conflict (kind, key) do nothing
  returning id into added;
  return added is not null;
end;
$$;

-- ── Claiming the jobs due ────────────────────────────────────────────────────────

-- Hands out at most p_limit jobs due, oldest first, each held for p_lease_seconds under a fresh claim and its
-- tries one more. First, each claim that ran out is written as a `lost` try: the job is due again, or failed
-- when that was its 5th try. Both statements skip the rows another worker holds locked, so two workers never
-- hold one job. 22023 a limit or a lease out of range.
create function public.background_job_claim(p_limit integer, p_lease_seconds integer) returns setof public.background_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  lost public.background_jobs;
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
       set state         = case when lost.tries >= 5 then 'failed' else 'queued' end,
           run_after     = now(),
           reason        = case when lost.tries >= 5 then 'its claim ran out on its last try' end,
           finished_at   = case when lost.tries >= 5 then now() end,
           claim         = null,
           claimed_at    = null,
           claimed_until = null
     where j.id = lost.id;
  end loop;

  return query
  with due as (
    select d.id from public.background_jobs d
     where d.state = 'queued' and d.run_after <= now()
     order by d.run_after, d.created_at, d.id
     limit p_limit
     for update skip locked
  )
  update public.background_jobs j
     set state         = 'running',
         tries         = j.tries + 1,
         claim         = gen_random_uuid(),
         claimed_at    = now(),
         claimed_until = now() + make_interval(secs => p_lease_seconds)
    from due
   where j.id = due.id
  returning j.*;
end;
$$;

-- ── Finishing a try ──────────────────────────────────────────────────────────────

-- Records the try of job p_id held under p_claim, and moves the job:
--   done      done
--   skipped   skipped, p_reason saying why (required)
--   retry     queued again at p_retry_at (required), the error in p_reason; failed instead on its 5th try
--   waiting   queued again at p_retry_at (required), its try given back: GitHub's budget was low
--   failed    failed, p_reason the error (required)
-- Answers the job's state. 22023 a malformed value, P0002 no such job, 55000 a claim that is no longer the job's.
create function public.background_job_finish(p_id uuid, p_claim uuid, p_outcome text, p_reason text, p_retry_at timestamptz)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  job       public.background_jobs;
  v_outcome text := p_outcome;
  v_reason  text := public.background_job_line(p_reason);
  v_state   text;
begin
  if v_outcome is null or v_outcome not in ('done', 'skipped', 'retry', 'waiting', 'failed') then
    raise exception 'Outcome: done, skipped, retry, waiting or failed.' using errcode = '22023', hint = 'outcome';
  end if;
  if v_outcome in ('skipped', 'failed') and v_reason is null then
    raise exception 'Reason: why the job is %.', v_outcome using errcode = '22023', hint = 'reason';
  end if;
  if v_outcome in ('retry', 'waiting') and p_retry_at is null then
    raise exception 'Retry at: when the job may run again.' using errcode = '22023', hint = 'retry_at';
  end if;

  select * into job from public.background_jobs j where j.id = p_id for update;
  if not found then
    raise exception 'Job: % does not exist.', p_id using errcode = 'P0002', hint = 'id';
  end if;
  if job.state <> 'running' or p_claim is null or job.claim is distinct from p_claim then
    raise exception 'Claim: job % is no longer held by this claim.', p_id using errcode = '55000', hint = 'claim';
  end if;

  if v_outcome = 'retry' and job.tries >= 5 then
    v_outcome := 'failed';
  end if;
  if v_outcome = 'failed' and v_reason is null then
    v_reason := 'it failed on its last try';
  end if;

  insert into public.background_job_attempts (job_id, try, started_at, ended_at, outcome, error)
  values (job.id, job.tries, job.claimed_at, now(), v_outcome, case when v_outcome = 'done' then null else v_reason end);

  v_state := case v_outcome when 'retry' then 'queued' when 'waiting' then 'queued' else v_outcome end;
  update public.background_jobs j
     set state         = v_state,
         tries         = case when v_outcome = 'waiting' then greatest(j.tries - 1, 0) else j.tries end,
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

-- ── Replaying a failed job ───────────────────────────────────────────────────────

-- Puts failed job p_id back to queued, due now, its tries at zero; its attempts stay. Answers the job. P0002 no
-- such job, 55000 a job that is not failed.
create function public.background_job_replay(p_id uuid) returns public.background_jobs
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
     set state = 'queued', tries = 0, run_after = now(), reason = null, finished_at = null
   where j.id = job.id
  returning * into job;
  return job;
end;
$$;

-- ── Is it jammed? ────────────────────────────────────────────────────────────────

-- {state: ok | late, late: <jobs due for over an hour>, failed: <failed jobs with no later done job of the same
-- kind and subject>}; late when either count is above zero. Counts only: no repository, no error. A claim that
-- ran out over an hour ago counts as due.
create function public.background_jobs_health() returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with counts as (
    select
      (select count(*) from public.background_jobs j
        where (j.state = 'queued' and j.run_after < now() - interval '1 hour')
           or (j.state = 'running' and j.claimed_until < now() - interval '1 hour'))::integer as late,
      (select count(*) from public.background_jobs f
        where f.state = 'failed'
          and not exists (select 1 from public.background_jobs d
                           where d.state = 'done' and d.kind = f.kind and d.subject = f.subject
                             and d.finished_at > f.finished_at))::integer as failed
  )
  select jsonb_build_object('state', case when c.late > 0 or c.failed > 0 then 'late' else 'ok' end,
                            'late', c.late, 'failed', c.failed)
    from counts c;
$$;

-- ── Forgetting old rows (L-GDPR-4) ───────────────────────────────────────────────

-- Deletes the jobs done, skipped or failed over 90 days ago, with their attempts. Answers how many jobs.
create function public.background_jobs_forget() returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  gone integer;
begin
  delete from public.background_jobs j
   where j.state in ('done', 'skipped', 'failed') and j.finished_at < now() - interval '90 days';
  get diagnostics gone = row_count;
  return gone;
end;
$$;

-- ── Who may read and call what ───────────────────────────────────────────────────

alter table public.background_jobs enable row level security;
alter table public.background_job_attempts enable row level security;

-- Explicit grants, and nothing more (config.toml › auto_expose_new_tables = false): the service role reads, and
-- writes only through the functions; nobody else reads or calls anything.
revoke all on public.background_jobs from public, anon, authenticated, service_role;
revoke all on public.background_job_attempts from public, anon, authenticated, service_role;
grant select on public.background_jobs to service_role;
grant select on public.background_job_attempts to service_role;

revoke execute on function public.background_job_line(text) from public, anon, authenticated, service_role;
revoke execute on function public.background_job_add(text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.background_job_add(text, text, text, jsonb) to service_role;
revoke execute on function public.background_job_claim(integer, integer) from public, anon, authenticated;
grant execute on function public.background_job_claim(integer, integer) to service_role;
revoke execute on function public.background_job_finish(uuid, uuid, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.background_job_finish(uuid, uuid, text, text, timestamptz) to service_role;
revoke execute on function public.background_job_replay(uuid) from public, anon, authenticated;
grant execute on function public.background_job_replay(uuid) to service_role;
revoke execute on function public.background_jobs_health() from public, anon, authenticated;
grant execute on function public.background_jobs_health() to service_role;
revoke execute on function public.background_jobs_forget() from public, anon, authenticated;
grant execute on function public.background_jobs_forget() to service_role;
