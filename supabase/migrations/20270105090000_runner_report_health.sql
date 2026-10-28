-- A runner's health report in one call (bug #2557): the route made six calls to the database one after
-- another (the runner, the lost jobs, the runner's update, the sample, the trim), each 0.1 to 2 s, and
-- together they passed the 5 s the runner waits for an answer.
--
--   runner_report_health(runner, owner, at, health, sample, lost_cutoff, kept_since)
--     'missing' for no such runner and 'forbidden' for a runner someone else registered, writing nothing;
--     otherwise ends `runner lost` the jobs of every runner silent since before `lost_cutoff`
--     (runners_mark_lost()), stores `health` as the runner's last health with `at` as its check-in, adds
--     `sample` (runner_samples' columns; one already held at that instant stays as it is), deletes the
--     runner's samples taken before `kept_since`, and answers 'ok'.
--
-- The service role calls it, as the routes write runners and runner_samples; nobody signed in does.
--
-- Proven by supabase/checks/runner_samples.sql.
-- Rollback: a follow-up migration drops runner_report_health(). Nothing else reads it.

create function public.runner_report_health(
  p_runner uuid, p_owner uuid, p_at timestamptz, p_health jsonb, p_sample jsonb, p_lost_cutoff timestamptz, p_kept_since timestamptz
) returns text
language plpgsql
set search_path = ''
as $$
declare
  v_runner public.runners;
begin
  select * into v_runner from public.runners where id = p_runner;
  if v_runner.id is null then return 'missing'; end if;
  if v_runner.owner <> p_owner then return 'forbidden'; end if;
  perform public.runners_mark_lost(p_lost_cutoff);
  update public.runners set health = p_health, last_seen_at = p_at where id = p_runner;
  insert into public.runner_samples (runner_id, workspace_id, at, cpu, mem_used, mem_total, disk_free, tokens_5h)
  select p_runner, v_runner.workspace_id, p_at, s.cpu, s.mem_used, s.mem_total, s.disk_free, s.tokens_5h
    from jsonb_populate_record(null::public.runner_samples, p_sample) s
  on conflict (runner_id, at) do nothing;
  delete from public.runner_samples where runner_id = p_runner and at < p_kept_since;
  return 'ok';
end;
$$;

revoke execute on function public.runner_report_health(uuid, uuid, timestamptz, jsonb, jsonb, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.runner_report_health(uuid, uuid, timestamptz, jsonb, jsonb, timestamptz, timestamptz) to service_role;
