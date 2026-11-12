-- A job can live for days (PRD omni-loop-4 s1, spec "What the ledger gains"): it saves each finished step in a
-- table of its own and reads them back on its next run, it can be woken early, and it keeps its claim while it
-- runs.
--
-- - background_job_steps: one row per finished step of a job (the job, the step's id, its value as JSON, when it
--   was saved). Deleted with its job: by background_jobs_forget() 90 days after the job finished (L-GDPR-4). A
--   replay, a refresh and a `later` keep them: a run carries on from its last saved step.
-- - background_job_save(id, claim, step, value): writes one step under the job's claim, the latest value kept
--   when the step was saved before. A claim that is no longer the job's is refused (55000), as for
--   background_job_finish(); a value over 1 MB is refused (22023) naming the step. A null value is saved as JSON
--   null.
-- - background_job_steps_of(id, claim): the job's saved steps, oldest first, under its claim; a claim that is no
--   longer the job's is refused (55000). background_job_claim() reads no step, so a large step never slows it.
-- - background_job_wake(kind, key): makes the queued job of that kind and key due now; does nothing to a job
--   running or finished, nor to one that is not there. Answers whether it woke one.
-- - background_job_renew(id, claim, lease_seconds): extends a running job's claim to lease_seconds from now (300
--   when not given), never shortening it; a claim that is no longer the job's is refused (55000). Answers when
--   the claim now runs out. The worker renews after each saved step, and every minute while a step runs.
-- - Who: the service role alone reads the table and calls the four functions, as for every other part of the
--   ledger. A saved step may hold GitHub logins, never a token (L-GDPR-1, L-GDPR-2).
--
-- Every change adds: one table and four functions. Nothing existing is changed or dropped.
--
-- Proven by supabase/checks/background_jobs.sql.
--
-- Rollback (the down script): a follow-up migration that drops the four functions, then background_job_steps.
-- Revert the App's callers first (apps/omni-app/src/jobs/ledger.ts, saved-step.ts, worker.ts).

-- ── The saved steps ──────────────────────────────────────────────────────────────

create table public.background_job_steps (
  job_id   uuid not null references public.background_jobs (id) on delete cascade,
  step     text not null constraint background_job_steps_step_check check (char_length(step) between 1 and 200),
  value    jsonb not null,
  saved_at timestamptz not null default now(),
  constraint background_job_steps_pkey primary key (job_id, step)
);

comment on table public.background_job_steps is
  'PRD omni-loop-4: one row per finished step of a background job, read back by its next run; deleted with its job. Written only through background_job_save(); read by the service role alone.';
comment on column public.background_job_steps.step is 'The step''s id, as the job''s code names it (`qualify`, `publish`).';
comment on column public.background_job_steps.value is 'What the step returned, as JSON, at most 1 MB; never a token.';
comment on column public.background_job_steps.saved_at is 'When the step was last saved.';

-- The job p_id, locked, when p_claim holds it; else 55000 (or P0002 when there is no such job).
create function public.background_job_held(p_id uuid, p_claim uuid) returns public.background_jobs
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
  if job.state <> 'running' or p_claim is null or job.claim is distinct from p_claim then
    raise exception 'Claim: job % is no longer held by this claim.', p_id using errcode = '55000', hint = 'claim';
  end if;
  return job;
end;
$$;

-- ── Saving a step ────────────────────────────────────────────────────────────────

-- Saves step p_step of job p_id, held under p_claim, with p_value (null: JSON null); a step saved before keeps
-- the latest value. 22023 a malformed step or a value over 1 MB, the step named; P0002 no such job; 55000 a
-- claim that is no longer the job's.
create function public.background_job_save(p_id uuid, p_claim uuid, p_step text, p_value jsonb) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_step  text := btrim(coalesce(p_step, ''));
  v_value jsonb := coalesce(p_value, 'null'::jsonb);
begin
  if char_length(v_step) not between 1 and 200 then
    raise exception 'Step: between 1 and 200 characters.' using errcode = '22023', hint = 'step';
  end if;
  if octet_length(v_value::text) > 1048576 then
    raise exception 'Step "%": its value is over 1 MB.', v_step using errcode = '22023', hint = 'value';
  end if;
  perform public.background_job_held(p_id, p_claim);
  insert into public.background_job_steps (job_id, step, value)
  values (p_id, v_step, v_value)
  on conflict (job_id, step) do update set value = excluded.value, saved_at = now();
end;
$$;

-- ── Reading the steps back ───────────────────────────────────────────────────────

-- The saved steps of job p_id, held under p_claim, oldest first. P0002 no such job; 55000 a claim that is no
-- longer the job's.
create function public.background_job_steps_of(p_id uuid, p_claim uuid)
returns table (step text, value jsonb, saved_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.background_job_held(p_id, p_claim);
  return query
  select s.step, s.value, s.saved_at from public.background_job_steps s where s.job_id = p_id order by s.saved_at, s.step;
end;
$$;

-- ── Waking a job ─────────────────────────────────────────────────────────────────

-- Makes the queued job of p_kind under p_key due now (a job already due keeps its place); a job running,
-- finished or not there is left as it is. Answers whether it woke one.
create function public.background_job_wake(p_kind text, p_key text) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  woken uuid;
begin
  update public.background_jobs j
     set run_after = least(j.run_after, now())
   where j.kind = btrim(coalesce(p_kind, '')) and j.key = btrim(coalesce(p_key, '')) and j.state = 'queued'
  returning j.id into woken;
  return woken is not null;
end;
$$;

-- ── Renewing a claim ─────────────────────────────────────────────────────────────

-- Extends the claim p_claim of job p_id to p_lease_seconds from now (null: 300), never shortening it. Answers
-- when it now runs out. 22023 a lease out of range; P0002 no such job; 55000 a claim that is no longer the job's.
create function public.background_job_renew(p_id uuid, p_claim uuid, p_lease_seconds integer default null) returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lease integer := coalesce(p_lease_seconds, 300);
  job     public.background_jobs;
  v_until timestamptz;
begin
  if v_lease not between 10 and 3600 then
    raise exception 'Lease: between 10 and 3600 seconds.' using errcode = '22023', hint = 'lease_seconds';
  end if;
  job := public.background_job_held(p_id, p_claim);
  update public.background_jobs j
     set claimed_until = greatest(j.claimed_until, now() + make_interval(secs => v_lease))
   where j.id = job.id
  returning j.claimed_until into v_until;
  return v_until;
end;
$$;

-- ── Who may read and call what ───────────────────────────────────────────────────

alter table public.background_job_steps enable row level security;

-- Explicit grants, and nothing more (config.toml › auto_expose_new_tables = false): the service role reads, and
-- writes only through the functions; nobody else reads or calls anything.
revoke all on public.background_job_steps from public, anon, authenticated, service_role;
grant select on public.background_job_steps to service_role;

revoke execute on function public.background_job_held(uuid, uuid) from public, anon, authenticated, service_role;
revoke execute on function public.background_job_save(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.background_job_save(uuid, uuid, text, jsonb) to service_role;
revoke execute on function public.background_job_steps_of(uuid, uuid) from public, anon, authenticated;
grant execute on function public.background_job_steps_of(uuid, uuid) to service_role;
revoke execute on function public.background_job_wake(text, text) from public, anon, authenticated;
grant execute on function public.background_job_wake(text, text) to service_role;
revoke execute on function public.background_job_renew(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.background_job_renew(uuid, uuid, integer) to service_role;
