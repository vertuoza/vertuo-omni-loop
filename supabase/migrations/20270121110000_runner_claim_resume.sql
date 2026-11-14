-- A resume goes to the runner that keeps its chain's save (PRD 2809, s5, docs:
-- .omni-loop/delivery/inbox/2809-unlosable-jobs/spec.md, section 4, "Restoring"): a save whose bundle could not leave
-- its runner (`runner_checkpoints.kind = 'local'`, PRD 2809 s4) can be restored by that runner alone, so the resume waits
-- for it while it is online.
--
-- - runner_claim(runner, registered_at): as 20270120100000_runner_resume.sql, and a resume (`resumes` set) whose chain
--   holds a local save not deleted and still kept is handed to no runner but the one that keeps the newest such save,
--   while that runner is online (seen in the last 90 s, as LOST_AFTER_MS in apps/galaxy/src/runners/runners.contract.ts)
--   and could take the resume itself: an Omni App runner holding the job's repository, and its target (the runner the
--   job was sent to, its fleet, or no fleet for a job sent to any runner). Offline, or unable to take it, the resume goes
--   to any runner as before, and that runner's resume note says what stayed behind. The chain is the job it resumes and
--   the one that job resumed: three attempts at most (runner_jobs.attempt).
--
-- Returned columns: runner_jobs', as before. Nobody signed in calls it: only the service role, as before.
--
-- Laws kept: no membership, ask session, AI key, agent link, answer or ledger row is read or written (BR-PRODUCT-12,
-- 28, 29, 39, 59, 63, 64, N-PRODUCT-16); a resume merges nothing a person did not (N-PRODUCT-15).
--
-- Proven by supabase/checks/runner_resume.sql.
-- Rollback: a follow-up migration restores runner_claim(uuid, timestamptz) as 20270120100000_runner_resume.sql has it;
-- a resume is then claimed by any runner, the local save's runner included.

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
        -- A resume whose chain's newest local save is kept by another runner, online and able to take it, waits for it.
        and not exists (
          select 1
            from (select c.runner_id
                    from public.runner_checkpoints c
                    join public.runner_jobs p on p.id = c.job_id
                   where q.resumes is not null
                     and (c.job_id = q.resumes or c.job_id = (select b.resumes from public.runner_jobs b where b.id = q.resumes))
                     and c.kind = 'local' and c.deleted_at is null and c.keep_until > now()
                   order by p.attempt desc, c.updated_at desc
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
      order by q.queued_at, q.id
      limit 1
      for update skip locked)
     and j.status = 'queued'
  returning j.*;
end;
$$;

revoke execute on function public.runner_claim(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.runner_claim(uuid, timestamptz) to service_role;
