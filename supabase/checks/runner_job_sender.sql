-- Who sent a runner job: a person or the Omni app, never both and never neither (PRD 2338), run after
-- `supabase db start` has applied the migrations:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/runner_job_sender.sql
-- As the service role: a job with one sender, a person or the app, is stored; a job with both, or with
-- neither, is refused, and so is any app but `omni-app`. A member of the workspace reads an app-sent job;
-- an account of another workspace, or signed out, reads nothing; nobody signed in writes one. Any `FAIL:`
-- stops the run.

begin;

-- ── The cast ──
-- Ada is a member of the workspace Sender; Eve belongs to another.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000023380a1', 'ada@sender.test'),
  ('00000000-0000-4000-8000-0000023380e1', 'eve@elsewhere.test');
insert into public.workspaces (id, slug, name, github_org) values
  ('00000000-0000-4000-8000-000002338001', 'sender-check', 'Sender', 'sender-check'),
  ('00000000-0000-4000-8000-000002338002', 'sender-elsewhere', 'Elsewhere', 'sender-elsewhere');
insert into public.workspace_members (workspace_id, user_id, role) values
  ('00000000-0000-4000-8000-000002338001', '00000000-0000-4000-8000-0000023380a1', 'member'),
  ('00000000-0000-4000-8000-000002338002', '00000000-0000-4000-8000-0000023380e1', 'owner');

-- ── One sender, as the service role ──
set local role service_role;
do $$
begin
  -- A person's job and the app's job are stored.
  insert into public.runner_jobs (id, workspace_id, line, repo, sent_by)
  values ('00000000-0000-4000-8000-0000023381a1', '00000000-0000-4000-8000-000002338001', '/omni:yolo 1', 'sender-check/app', '00000000-0000-4000-8000-0000023380a1');
  insert into public.runner_jobs (id, workspace_id, line, repo, sent_by_app)
  values ('00000000-0000-4000-8000-0000023381b1', '00000000-0000-4000-8000-000002338001', '/omni:retro-apply --retro 2340', 'sender-check/app', 'omni-app');
  if (select count(*) from public.runner_jobs where workspace_id = '00000000-0000-4000-8000-000002338001') <> 2 then
    raise exception 'FAIL: a job with one sender was not stored';
  end if;
  -- Both senders are refused.
  begin
    insert into public.runner_jobs (workspace_id, line, repo, sent_by, sent_by_app)
    values ('00000000-0000-4000-8000-000002338001', '/omni:yolo 2', 'sender-check/app', '00000000-0000-4000-8000-0000023380a1', 'omni-app');
    raise exception 'FAIL: a job with both senders was stored';
  exception when check_violation then null; end;
  -- Neither is refused.
  begin
    insert into public.runner_jobs (workspace_id, line, repo) values ('00000000-0000-4000-8000-000002338001', '/omni:yolo 3', 'sender-check/app');
    raise exception 'FAIL: a job with no sender was stored';
  exception when check_violation or not_null_violation then null; end;
  -- No app but the Omni app.
  begin
    insert into public.runner_jobs (workspace_id, line, repo, sent_by_app) values ('00000000-0000-4000-8000-000002338001', '/omni:yolo 4', 'sender-check/app', 'someone-else');
    raise exception 'FAIL: a job from another app was stored';
  exception when check_violation then null; end;
  -- A person who sent a job cannot be taken off it, leaving it with no sender.
  begin
    update public.runner_jobs set sent_by = null where id = '00000000-0000-4000-8000-0000023381a1';
    raise exception 'FAIL: a person''s job lost its sender';
  exception when check_violation then null; end;
end $$;
reset role;

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- ── Who reads and writes an app-sent job ──
set local role anon;
do $$
begin
  begin perform 1 from public.runner_jobs limit 1; raise exception 'FAIL: anon read the runner jobs';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000023380a1');
do $$
begin
  if (select sent_by_app from public.runner_jobs where id = '00000000-0000-4000-8000-0000023381b1') is distinct from 'omni-app' then
    raise exception 'FAIL: a member did not read the app-sent job';
  end if;
  begin
    insert into public.runner_jobs (workspace_id, line, repo, sent_by_app)
    values ('00000000-0000-4000-8000-000002338001', '/omni:yolo 5', 'sender-check/app', 'omni-app');
    raise exception 'FAIL: a member queued a job as the app';
  exception when insufficient_privilege then null; end;
end $$;

select pg_temp.sign_in('00000000-0000-4000-8000-0000023380e1');
do $$
begin
  if exists (select 1 from public.runner_jobs where workspace_id = '00000000-0000-4000-8000-000002338001') then
    raise exception 'FAIL: another workspace read the app-sent job';
  end if;
end $$;
reset role;

rollback;

select 'runner_job_sender: every check passed' as result;
