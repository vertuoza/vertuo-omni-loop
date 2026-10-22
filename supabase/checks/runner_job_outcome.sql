-- What a runner job's ending may say (PRD 2375), run after `supabase db start` has applied the
-- migrations:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/runner_job_outcome.sql
-- As the service role: the outcomes `answers`, `held`, `ready`, `human` and `stopped` are stored, any
-- other is refused; a job's slice count is stored when it holds both numbers with 0 <= merged <= total,
-- and refused when merged is below 0, above total, or one number lacks the other. A member of the
-- workspace reads the columns; nobody signed in writes them. Any `FAIL:` stops the run.

begin;

-- ── The cast ──
-- Ada is a member of the workspace Outcome.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000023750a1', 'ada@outcome.test');
insert into public.workspaces (id, slug, name, github_org) values
  ('00000000-0000-4000-8000-000002375001', 'outcome-check', 'Outcome', 'outcome-check');
insert into public.workspace_members (workspace_id, user_id, role) values
  ('00000000-0000-4000-8000-000002375001', '00000000-0000-4000-8000-0000023750a1', 'member');

-- ── What the service role may store ──
set local role service_role;
do $$
declare
  v text;
begin
  -- Every outcome of the check is stored, and none at all.
  foreach v in array array['answers', 'held', 'ready', 'human', 'stopped'] loop
    insert into public.runner_jobs (workspace_id, line, repo, sent_by, outcome)
    values ('00000000-0000-4000-8000-000002375001', '/omni:yolo 1', 'outcome-check/app', '00000000-0000-4000-8000-0000023750a1', v);
  end loop;
  insert into public.runner_jobs (workspace_id, line, repo, sent_by)
  values ('00000000-0000-4000-8000-000002375001', '/omni:yolo 1', 'outcome-check/app', '00000000-0000-4000-8000-0000023750a1');
  if (select count(*) from public.runner_jobs where workspace_id = '00000000-0000-4000-8000-000002375001') <> 6 then
    raise exception 'FAIL: an accepted outcome was not stored';
  end if;
  -- Another outcome is refused.
  begin
    insert into public.runner_jobs (workspace_id, line, repo, sent_by, outcome)
    values ('00000000-0000-4000-8000-000002375001', '/omni:yolo 2', 'outcome-check/app', '00000000-0000-4000-8000-0000023750a1', 'done');
    raise exception 'FAIL: an unknown outcome was stored';
  exception when check_violation then null; end;

  -- A slice count within its total is stored: none merged, some, all.
  insert into public.runner_jobs (id, workspace_id, line, repo, sent_by, outcome, slices_merged, slices_total)
  values ('00000000-0000-4000-8000-0000023751a1', '00000000-0000-4000-8000-000002375001', '/omni:yolo 3', 'outcome-check/app',
          '00000000-0000-4000-8000-0000023750a1', 'stopped', 0, 5);
  insert into public.runner_jobs (workspace_id, line, repo, sent_by, outcome, slices_merged, slices_total)
  values ('00000000-0000-4000-8000-000002375001', '/omni:yolo 4', 'outcome-check/app',
          '00000000-0000-4000-8000-0000023750a1', 'stopped', 3, 5);
  insert into public.runner_jobs (workspace_id, line, repo, sent_by, outcome, slices_merged, slices_total)
  values ('00000000-0000-4000-8000-000002375001', '/omni:yolo 5', 'outcome-check/app',
          '00000000-0000-4000-8000-0000023750a1', 'stopped', 5, 5);
  -- A count below 0 is refused.
  begin
    insert into public.runner_jobs (workspace_id, line, repo, sent_by, slices_merged, slices_total)
    values ('00000000-0000-4000-8000-000002375001', '/omni:yolo 6', 'outcome-check/app', '00000000-0000-4000-8000-0000023750a1', -1, 5);
    raise exception 'FAIL: a negative merged count was stored';
  exception when check_violation then null; end;
  -- A count above its total is refused.
  begin
    insert into public.runner_jobs (workspace_id, line, repo, sent_by, slices_merged, slices_total)
    values ('00000000-0000-4000-8000-000002375001', '/omni:yolo 7', 'outcome-check/app', '00000000-0000-4000-8000-0000023750a1', 6, 5);
    raise exception 'FAIL: a merged count above its total was stored';
  exception when check_violation then null; end;
  -- A negative total is refused, and so is one number without the other.
  begin
    insert into public.runner_jobs (workspace_id, line, repo, sent_by, slices_merged, slices_total)
    values ('00000000-0000-4000-8000-000002375001', '/omni:yolo 8', 'outcome-check/app', '00000000-0000-4000-8000-0000023750a1', 0, -1);
    raise exception 'FAIL: a negative total was stored';
  exception when check_violation then null; end;
  begin
    insert into public.runner_jobs (workspace_id, line, repo, sent_by, slices_merged)
    values ('00000000-0000-4000-8000-000002375001', '/omni:yolo 9', 'outcome-check/app', '00000000-0000-4000-8000-0000023750a1', 2);
    raise exception 'FAIL: a merged count without a total was stored';
  exception when check_violation then null; end;
  begin
    insert into public.runner_jobs (workspace_id, line, repo, sent_by, slices_total)
    values ('00000000-0000-4000-8000-000002375001', '/omni:yolo 10', 'outcome-check/app', '00000000-0000-4000-8000-0000023750a1', 2);
    raise exception 'FAIL: a total without a merged count was stored';
  exception when check_violation then null; end;
  -- A stored count cannot be pushed out of range afterwards.
  begin
    update public.runner_jobs set slices_merged = 9 where id = '00000000-0000-4000-8000-0000023751a1';
    raise exception 'FAIL: a stored count was raised above its total';
  exception when check_violation then null; end;
end $$;
reset role;

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- ── Who reads and writes the columns ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000023750a1');
do $$
begin
  if (select slices_total from public.runner_jobs where id = '00000000-0000-4000-8000-0000023751a1') is distinct from 5 then
    raise exception 'FAIL: a member did not read the slice count';
  end if;
  begin
    update public.runner_jobs set outcome = 'stopped', slices_merged = 1, slices_total = 2
    where id = '00000000-0000-4000-8000-0000023751a1';
    raise exception 'FAIL: a member wrote a job''s outcome or count';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

rollback;

select 'runner_job_outcome: every check passed' as result;
