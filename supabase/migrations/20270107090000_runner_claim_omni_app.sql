-- Every runner job runs as the Omni GitHub App, never as a person (PRD 2573). The server gives each claimed
-- job the Omni App's token, and the runner refuses a job that comes without it, so a runner that did not
-- register `github_app` (a kit older than PRD 2433 s2) cannot run any job: it claims none and stays online.
-- As 20261228090000_api_key_github_apps.sql, with its fourth rule, the one on a job that needs a key's App,
-- replaced by this one. A job that needed an App no longer waits for a particular runner: a runner with
-- `github_app` takes it as it takes any other. The tables, marks and functions of a key's App stay, unused.
-- Returned columns: the same.
create or replace function public.runner_claim(p_runner uuid) returns setof public.runner_jobs
language plpgsql
set search_path = ''
as $$
declare
  r    public.runners;
  busy integer;
begin
  select * into r from public.runners where id = p_runner for update;
  if r.id is null or not r.github_app then
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
