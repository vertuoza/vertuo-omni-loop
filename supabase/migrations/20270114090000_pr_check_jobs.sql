-- The pull-request checks on the job ledger (PRD 2688 s1, docs: .omni-loop/delivery/inbox/2688-pr-checks-ledger/spec.md,
-- "Refresh: the latest state wins"): one job per pull request and check, keyed `<owner/name>#<number>`, which
-- every new event on the pull request refreshes, so a burst of pushes, labels and replies becomes one run on its
-- latest state.
--
-- - background_jobs.again: set by a refresh that finds the job running; the try's finish then queues it once
--   more. Held only while running.
-- - background_job_refresh(kind, key, subject, payload, delay_seconds): what a refresh does to the job of that
--   kind and key, and only that one:
--     none                         added, due in delay_seconds                                    `added`
--     queued                       the new payload, due delay_seconds from now; its tries kept    `updated`
--     running                      the new payload, and `again`                                   `again`
--     done, skipped or failed      queued, due in delay_seconds, with the new payload, its tries  `requeued`
--                                  at zero, its reason and finished_at cleared; its attempts kept
--   It locks the job first, so a refresh meeting a claim, a finish or another refresh waits for it and reads
--   the state it left: the new payload is never lost to a try already running.
-- - background_job_finish(): a try of a job holding `again` keeps its attempt line as before, whatever its
--   outcome, then the job is queued at once, its tries at zero, `again` cleared. Every other finish is unchanged.
-- - background_job_claim(): a claim that ran out on a job holding `again` keeps its `lost` line as before, then
--   the job is queued at once in the same way, even on its 5th try. Every other lost claim is unchanged.
-- - Who: the service role alone calls background_job_refresh(), as the ledger's other functions. The rows hold
--   repository names, pull request numbers and commits, no person (L-GDPR-1); the forget of PRD 2676 deletes a
--   job finished over 90 days ago with its attempts (L-GDPR-4).
--
-- Every change adds: one column with its check, one function, and new bodies for background_job_claim() and
-- background_job_finish() under the same signatures and grants. Nothing is dropped.
--
-- Proven by supabase/checks/background_jobs.sql.
--
-- Rollback (the down script): a follow-up migration that restores background_job_claim() and
-- background_job_finish() as 20270113090000_background_jobs.sql wrote them, drops background_job_refresh(), then
-- the column and its check. Revert the App's callers of the refresh first.

-- ── The column ───────────────────────────────────────────────────────────────────

alter table public.background_jobs
  add column again boolean not null default false,
  add constraint background_jobs_again_check check (not again or state = 'running');

comment on column public.background_jobs.again is
  'PRD 2688: a refresh came while the job ran; its try''s finish queues it once more, due at once. Only while running.';

-- ── Refreshing a job ─────────────────────────────────────────────────────────────

-- Refreshes the job of p_kind under p_key with p_payload, as the table above says; answers what it did: added,
-- updated, again or requeued. Never touches a job of another kind. 22023 a malformed value, its field first in
-- the message and in `hint`; 40001 when the job vanished three times between the insert and the lock.
create function public.background_job_refresh(p_kind text, p_key text, p_subject text, p_payload jsonb, p_delay_seconds integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind    text := btrim(coalesce(p_kind, ''));
  v_key     text := btrim(coalesce(p_key, ''));
  v_subject text := lower(btrim(coalesce(p_subject, '')));
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
  v_due := now() + make_interval(secs => p_delay_seconds);

  -- Added, or the job the kind holds under the key, locked: a claim, a finish or a refresh holding it is waited
  -- for. A job forgotten between the two statements is added on the next turn.
  for turn in 1..3 loop
    insert into public.background_jobs (kind, key, subject, payload, run_after)
    values (v_kind, v_key, v_subject, p_payload, v_due)
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
    update public.background_jobs j set payload = p_payload, run_after = v_due where j.id = job.id;
    return 'updated';
  end if;
  if job.state = 'running' then
    update public.background_jobs j set payload = p_payload, again = true where j.id = job.id;
    return 'again';
  end if;
  update public.background_jobs j
     set state = 'queued', payload = p_payload, tries = 0, run_after = v_due, reason = null, finished_at = null
   where j.id = job.id;
  return 'requeued';
end;
$$;

-- ── Claiming the jobs due: a lost claim holding `again` is queued at once ────────

-- As 20270113090000_background_jobs.sql wrote it, but a claim that ran out on a job holding `again` queues the
-- job at once, its tries at zero, even on its 5th try.
create or replace function public.background_job_claim(p_limit integer, p_lease_seconds integer) returns setof public.background_jobs
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
       set state         = case when lost.tries >= 5 and not lost.again then 'failed' else 'queued' end,
           tries         = case when lost.again then 0 else j.tries end,
           run_after     = now(),
           reason        = case when lost.tries >= 5 and not lost.again then 'its claim ran out on its last try' end,
           finished_at   = case when lost.tries >= 5 and not lost.again then now() end,
           again         = false,
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

-- ── Finishing a try: a job holding `again` is queued at once ─────────────────────

-- As 20270113090000_background_jobs.sql wrote it, but a try of a job holding `again` keeps its attempt line as
-- before, whatever its outcome, then queues the job at once, its tries at zero, its reason and finished_at
-- cleared, `again` cleared; it answers `queued`.
create or replace function public.background_job_finish(p_id uuid, p_claim uuid, p_outcome text, p_reason text default null,
                                                         p_retry_at timestamptz default null)
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

  if job.again then
    update public.background_jobs j
       set state         = 'queued',
           tries         = 0,
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

-- ── Who may call it ──────────────────────────────────────────────────────────────

revoke execute on function public.background_job_refresh(text, text, text, jsonb, integer) from public, anon, authenticated;
grant execute on function public.background_job_refresh(text, text, text, jsonb, integer) to service_role;
