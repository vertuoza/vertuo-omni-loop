-- Who may read and write a runner job's live lines (PRD 1904), run after `supabase db start` has applied
-- the migrations:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/runner_job_lines.sql
-- A member of the workspace reads its jobs' lines; an account of another workspace, or signed out,
-- nothing; nobody signed in adds, changes or deletes a line, or calls runner_job_lines_retain(). As the
-- service role: a line added twice is held once, and runner_job_lines_retain() deletes the lines of the
-- workspace's ended jobs beyond its most recent, keeping a running job's. Deleting a job deletes its
-- lines. Any `FAIL:` stops the run.

begin;

-- ── The cast ──
-- Olga owns the workspace Lines, Mo is a member of it; Eve belongs to another workspace.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000019040a1', 'olga@lines.test'),
  ('00000000-0000-4000-8000-0000019040b1', 'mo@lines.test'),
  ('00000000-0000-4000-8000-0000019040e1', 'eve@elsewhere.test');
insert into public.workspaces (id, slug, name, github_org) values
  ('00000000-0000-4000-8000-000001904001', 'lines-check', 'Lines', 'lines-check'),
  ('00000000-0000-4000-8000-000001904002', 'lines-elsewhere', 'Elsewhere', 'lines-elsewhere');
insert into public.workspace_members (workspace_id, user_id, role) values
  ('00000000-0000-4000-8000-000001904001', '00000000-0000-4000-8000-0000019040a1', 'owner'),
  ('00000000-0000-4000-8000-000001904001', '00000000-0000-4000-8000-0000019040b1', 'member'),
  ('00000000-0000-4000-8000-000001904002', '00000000-0000-4000-8000-0000019040e1', 'owner');

-- One runner of Olga's, three jobs: one running, one that ended an hour ago, one that ended now.
insert into public.runners (id, workspace_id, owner, name, repos) values
  ('00000000-0000-4000-8000-0000019041a1', '00000000-0000-4000-8000-000001904001', '00000000-0000-4000-8000-0000019040a1', 'box', '{lines-check/app}');
insert into public.runner_jobs (id, workspace_id, line, repo, sent_by, status, runner_id, claimed_at, running_at, ended_at) values
  ('00000000-0000-4000-8000-0000019042a1', '00000000-0000-4000-8000-000001904001', '/omni:yolo 1', 'lines-check/app', '00000000-0000-4000-8000-0000019040b1', 'running', '00000000-0000-4000-8000-0000019041a1', now(), now(), null),
  ('00000000-0000-4000-8000-0000019042b1', '00000000-0000-4000-8000-000001904001', '/omni:yolo 2', 'lines-check/app', '00000000-0000-4000-8000-0000019040b1', 'done', '00000000-0000-4000-8000-0000019041a1', now(), now(), now() - interval '1 hour'),
  ('00000000-0000-4000-8000-0000019042c1', '00000000-0000-4000-8000-000001904001', '/omni:yolo 3', 'lines-check/app', '00000000-0000-4000-8000-0000019040b1', 'failed', '00000000-0000-4000-8000-0000019041a1', now(), now(), now());
insert into public.runner_job_lines (job_id, workspace_id, seq, text) values
  ('00000000-0000-4000-8000-0000019042a1', '00000000-0000-4000-8000-000001904001', 1, '12:04:31 Bash: pnpm test'),
  ('00000000-0000-4000-8000-0000019042a1', '00000000-0000-4000-8000-000001904001', 2, '12:04:40 Edit: src/app.ts'),
  ('00000000-0000-4000-8000-0000019042b1', '00000000-0000-4000-8000-000001904001', 1, '11:00:00 Bash: pnpm lint'),
  ('00000000-0000-4000-8000-0000019042c1', '00000000-0000-4000-8000-000001904001', 1, '12:10:00 ✗ pnpm test failed');

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- ── Signed out: nothing ──
set local role anon;
do $$
begin
  begin perform 1 from public.runner_job_lines limit 1; raise exception 'FAIL: anon read the runner job lines';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── A member reads; nobody signed in writes ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000019040b1');
do $$
begin
  if (select count(*) from public.runner_job_lines where workspace_id = '00000000-0000-4000-8000-000001904001') <> 4 then
    raise exception 'FAIL: a member did not read the workspace''s four lines';
  end if;
  begin
    insert into public.runner_job_lines (job_id, workspace_id, seq, text)
    values ('00000000-0000-4000-8000-0000019042a1', '00000000-0000-4000-8000-000001904001', 3, 'forged');
    raise exception 'FAIL: a member wrote a line';
  exception when insufficient_privilege then null; end;
  begin
    update public.runner_job_lines set text = 'changed' where job_id = '00000000-0000-4000-8000-0000019042a1';
    raise exception 'FAIL: a member wrote a line by changing it';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.runner_job_lines where job_id = '00000000-0000-4000-8000-0000019042a1';
    raise exception 'FAIL: a member wrote a line by deleting it';
  exception when insufficient_privilege then null; end;
  begin
    perform public.runner_job_lines_retain('00000000-0000-4000-8000-000001904001', 0);
    raise exception 'FAIL: a member deleted lines through runner_job_lines_retain()';
  exception when insufficient_privilege then null; end;
end $$;

-- An account of another workspace reads nothing.
select pg_temp.sign_in('00000000-0000-4000-8000-0000019040e1');
do $$
begin
  if exists (select 1 from public.runner_job_lines where workspace_id = '00000000-0000-4000-8000-000001904001') then
    raise exception 'FAIL: another workspace read the runner job lines';
  end if;
end $$;
reset role;

-- ── Appending and retention, as the service role ──
set local role service_role;
do $$
declare
  running constant uuid := '00000000-0000-4000-8000-0000019042a1';
  older   constant uuid := '00000000-0000-4000-8000-0000019042b1';
  newer   constant uuid := '00000000-0000-4000-8000-0000019042c1';
begin
  -- A line sent again is held once, as it was first sent.
  insert into public.runner_job_lines (job_id, workspace_id, seq, text)
  values (running, '00000000-0000-4000-8000-000001904001', 2, 'again'), (running, '00000000-0000-4000-8000-000001904001', 3, '12:05:00 › Done editing')
  on conflict (job_id, seq) do nothing;
  if (select count(*) from public.runner_job_lines where job_id = running) <> 3
     or (select text from public.runner_job_lines where job_id = running and seq = 2) <> '12:04:40 Edit: src/app.ts' then
    raise exception 'FAIL: a line sent again was not held once, as first sent';
  end if;
  -- A line longer than 600 characters is refused.
  begin
    insert into public.runner_job_lines (job_id, workspace_id, seq, text) values (running, '00000000-0000-4000-8000-000001904001', 4, repeat('x', 601));
    raise exception 'FAIL: a line of 601 characters was stored';
  exception when check_violation then null; end;
  -- Keeping the most recent ended job: the older one's line goes, the newer's and the running job's stay.
  if public.runner_job_lines_retain('00000000-0000-4000-8000-000001904001', 1) <> 1 then
    raise exception 'FAIL: retention did not delete exactly the older ended job''s line';
  end if;
  if exists (select 1 from public.runner_job_lines where job_id = older)
     or not exists (select 1 from public.runner_job_lines where job_id = newer)
     or (select count(*) from public.runner_job_lines where job_id = running) <> 3 then
    raise exception 'FAIL: retention kept the wrong lines';
  end if;
  -- Another workspace's lines are never touched by this one's retention.
  if public.runner_job_lines_retain('00000000-0000-4000-8000-000001904002', 0) <> 0 then
    raise exception 'FAIL: retention of an empty workspace deleted lines';
  end if;
end $$;
reset role;

-- Deleting a job deletes its lines.
delete from public.runner_jobs where id = '00000000-0000-4000-8000-0000019042c1';
do $$
begin
  if exists (select 1 from public.runner_job_lines where job_id = '00000000-0000-4000-8000-0000019042c1') then
    raise exception 'FAIL: a deleted job kept its lines';
  end if;
end $$;

rollback;

select 'runner_job_lines: every check passed' as result;
