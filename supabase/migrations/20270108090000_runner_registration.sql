-- A runner's check-in claims only for the registration it began under (bug #2593).
--
-- GET /api/runners/next holds a runner's check-in up to 40 s, claiming any job that arrives. A runner
-- restarted mid check-in leaves that check-in held on the app, which never learns the runner hung up; a job
-- sent before it ends was claimed for the runner and answered to nobody, and ended runner lost.
--
-- - runners.registered_at: when the runner last registered (its first registration, then each one after).
--   The register route sets it; nothing else changes it.
-- - runner_claim(runner, registered_at): as 20270107090000_runner_claim_omni_app.sql, and it claims nothing
--   when `registered_at` is given and is not the runner's: the check-in began under a registration that has
--   since been replaced. It reads the runner `for update`, so a registration and a claim never cross. With
--   `registered_at` null (an app from before this migration) it claims as before.
--
-- Returned columns: the same. Only the service role calls it, as before.
-- Proven by supabase/checks/runners.sql.
-- Rollback: a follow-up migration restores runner_claim(uuid) as 20270107090000 has it and drops the column.

alter table public.runners add column registered_at timestamptz not null default now();

comment on column public.runners.registered_at is
  'When the runner last registered (bug #2593): a check-in claims a job only for the registration it began under. Written by the register route.';

drop function public.runner_claim(uuid);

create function public.runner_claim(p_runner uuid, p_registered_at timestamptz default null) returns setof public.runner_jobs
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
