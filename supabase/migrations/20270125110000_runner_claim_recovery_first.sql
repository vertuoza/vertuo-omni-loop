-- The claim takes recovery first, and never hands a job to a runner that cannot run one (PRD 2949, s3, docs:
-- .omni-loop/delivery/inbox/2949-limit-waits/spec.md, section 3).
--
-- - runner_claim(runner, registered_at): as 20270121110000_runner_claim_resume.sql, and:
--   - Recovery comes first. A resume (`resumes` set: of a lost runner, PRD 2809, or of a provider limit,
--     20270125100000_runner_limit_waits.sql) is claimed before any fresh job, the resumes ordered by when the first job
--     of their chain was queued, then by their own queued time. The runner's `slots` bound it as before.
--   - No job to a runner with every account out. A runner whose last health (`runners.health`, its `at` the server's
--     time) is less than two minutes old, and lists at least one account, each `out` with a `resetsAt` still to come,
--     is handed nothing. A runner with no health, an older one, or one that lists no account is judged by its own pause,
--     as before: a paused runner does not ask. A `resetsAt` or an `at` that does not read as a time counts as none.
--   - A chain is followed whole: a limit's waits make chains longer than three jobs (three tries and six waits), so the
--     first queued time, and the newest local save a resume waits for, are read over every job the chain resumes, not
--     the two before it. The newest save is the one of the job nearest the resume, then the one saved last.
--
-- Returned columns: runner_jobs', as before. Nobody signed in calls it: only the service role, as before.
--
-- Laws kept: no membership, ask session, AI key, agent link, answer or ledger row is read or written (BR-PRODUCT-12,
-- 28, 29, 39, 59, 63, 64, N-PRODUCT-16); a resume merges nothing a person did not (N-PRODUCT-15); a job whose cancel
-- was asked is never claimed (BR-PRODUCT-134).
--
-- Proven by supabase/checks/runner_resume.sql.
-- Rollback: a follow-up migration restores runner_claim(uuid, timestamptz) as 20270121110000_runner_claim_resume.sql
-- has it; the queue is then first in, first out again, and a runner with every account out is handed jobs it fails.

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
  -- A runner whose fresh health reports every account out until a time to come is handed nothing: it would fail the job.
  -- Each step is its own test, so no cast runs on a value that does not read as a time.
  if jsonb_typeof(r.health -> 'accounts') = 'array' and pg_catalog.pg_input_is_valid(r.health ->> 'at', 'timestamptz') then
    if (r.health ->> 'at')::timestamptz > now() - interval '2 minutes' and jsonb_array_length(r.health -> 'accounts') > 0
       and not exists (
         select 1 from jsonb_array_elements(r.health -> 'accounts') a
          where case when a ->> 'state' = 'out' and pg_catalog.pg_input_is_valid(a ->> 'resetsAt', 'timestamptz')
                     then (a ->> 'resetsAt')::timestamptz <= now() else true end) then
      return;
    end if;
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
        -- A resume whose chain's newest local save is kept by another runner, online and able to take it, waits for it.
        and not exists (
          select 1
            from (with recursive chain (id, depth) as (
                    select q.resumes, 1 where q.resumes is not null
                    union all
                    select b.resumes, chain.depth + 1 from chain join public.runner_jobs b on b.id = chain.id
                     where b.resumes is not null and chain.depth < 20)
                  select c.runner_id
                    from chain
                    join public.runner_checkpoints c on c.job_id = chain.id
                   where c.kind = 'local' and c.deleted_at is null and c.keep_until > now()
                   order by chain.depth, c.updated_at desc
                   limit 1) keeper
            join public.runners k on k.id = keeper.runner_id
           where k.id <> r.id
             and k.workspace_id = q.workspace_id
             and k.github_app
             and k.last_seen_at > now() - interval '90 seconds'
             and q.repo = any (k.repos)
             and (q.to_runner = k.id
                  or (q.to_runner is null and q.to_fleet is not null and q.to_fleet = k.fleet)
                  or (q.to_runner is null and q.to_fleet is null and k.fleet is null)))
      -- Recovery first: every resume before any fresh job, by when the first job of its chain was queued.
      order by q.resumes is null,
               (with recursive chain (id, resumes, queued_at, depth) as (
                  select b.id, b.resumes, b.queued_at, 1 from public.runner_jobs b where b.id = q.resumes
                  union all
                  select b.id, b.resumes, b.queued_at, chain.depth + 1 from chain join public.runner_jobs b on b.id = chain.resumes
                   where chain.depth < 20)
                select min(chain.queued_at) from chain),
               q.queued_at, q.id
      limit 1
      for update skip locked)
     and j.status = 'queued'
  returning j.*;
end;
$$;

revoke execute on function public.runner_claim(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.runner_claim(uuid, timestamptz) to service_role;
