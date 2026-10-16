-- Who may read and write a runner's health and its samples (PRD 2102), run after `supabase db start`
-- has applied the migrations:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/runner_samples.sql
-- A member of the workspace reads its runners' samples and last health; an account of another
-- workspace, or signed out, nothing; nobody signed in adds, changes or deletes a sample, or writes a
-- runner's health. As the service role: a sample is one per runner and instant, a figure out of range is
-- refused, the route stores a job's tokens (runner_jobs.tokens, member-read, service-role-written), and the route's trim deletes one runner's old samples and no other's. Deleting a runner
-- deletes its samples. Any `FAIL:` stops the run.

begin;

-- ── The cast ──
-- Olga owns the workspace Health, Mo is a member of it; Eve belongs to another workspace.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000021020a1', 'olga@health.test'),
  ('00000000-0000-4000-8000-0000021020b1', 'mo@health.test'),
  ('00000000-0000-4000-8000-0000021020e1', 'eve@elsewhere.test');
insert into public.workspaces (id, slug, name, github_org) values
  ('00000000-0000-4000-8000-000002102001', 'health-check', 'Health', 'health-check'),
  ('00000000-0000-4000-8000-000002102002', 'health-elsewhere', 'Elsewhere', 'health-elsewhere');
insert into public.workspace_members (workspace_id, user_id, role) values
  ('00000000-0000-4000-8000-000002102001', '00000000-0000-4000-8000-0000021020a1', 'owner'),
  ('00000000-0000-4000-8000-000002102001', '00000000-0000-4000-8000-0000021020b1', 'member'),
  ('00000000-0000-4000-8000-000002102002', '00000000-0000-4000-8000-0000021020e1', 'owner');

-- Two runners of Olga's: one that reported, with two samples, one from before this PRD.
insert into public.runners (id, workspace_id, owner, name, repos, health) values
  ('00000000-0000-4000-8000-0000021021a1', '00000000-0000-4000-8000-000002102001', '00000000-0000-4000-8000-0000021020a1', 'box', '{health-check/app}',
   '{"cpu": 63.5, "load1": 7.9, "cores": 8, "memUsed": 13958643712, "memTotal": 17179869184, "diskFree": 41875931136, "diskTotal": 249821655040, "at": "2026-10-16T12:00:00.000Z"}'),
  ('00000000-0000-4000-8000-0000021021b1', '00000000-0000-4000-8000-000002102001', '00000000-0000-4000-8000-0000021020a1', 'old-box', '{health-check/app}', null);
insert into public.runner_samples (runner_id, workspace_id, at, cpu, mem_used, mem_total, disk_free) values
  ('00000000-0000-4000-8000-0000021021a1', '00000000-0000-4000-8000-000002102001', now() - interval '2 hours', 12, 1, 2, 3),
  ('00000000-0000-4000-8000-0000021021a1', '00000000-0000-4000-8000-000002102001', now() - interval '15 seconds', 63.5, 13958643712, 17179869184, 41875931136),
  ('00000000-0000-4000-8000-0000021021b1', '00000000-0000-4000-8000-000002102001', now() - interval '2 hours', 5, 1, 2, 3);

-- A job of Olga's, with the tokens its runner reported (a later migration, 20261212090000_runner_tokens.sql).
insert into public.runner_jobs (id, workspace_id, line, repo, sent_by, tokens) values
  ('00000000-0000-4000-8000-0000021022a1', '00000000-0000-4000-8000-000002102001', '/omni:yolo 7', 'health-check/app', '00000000-0000-4000-8000-0000021020a1',
   '{"input": 5, "output": 6, "cacheRead": 7, "cacheWrite": 8}');

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- ── Signed out: nothing ──
set local role anon;
do $$
begin
  begin perform 1 from public.runner_samples limit 1; raise exception 'FAIL: anon read the runner samples';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── A member reads; nobody signed in writes ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000021020b1');
do $$
begin
  if (select count(*) from public.runner_samples where workspace_id = '00000000-0000-4000-8000-000002102001') <> 3 then
    raise exception 'FAIL: a member did not read the workspace''s three samples';
  end if;
  if (select (health ->> 'cpu')::numeric from public.runners where id = '00000000-0000-4000-8000-0000021021a1') <> 63.5 then
    raise exception 'FAIL: a member did not read the runner''s last health';
  end if;
  if (select (tokens ->> 'cacheRead')::integer from public.runner_jobs where id = '00000000-0000-4000-8000-0000021022a1') <> 7 then
    raise exception 'FAIL: a member did not read the job''s tokens';
  end if;
  begin
    insert into public.runner_samples (runner_id, workspace_id, cpu) values ('00000000-0000-4000-8000-0000021021a1', '00000000-0000-4000-8000-000002102001', 99);
    raise exception 'FAIL: a member wrote a sample';
  exception when insufficient_privilege then null; end;
  begin
    update public.runner_samples set cpu = 1 where runner_id = '00000000-0000-4000-8000-0000021021a1';
    raise exception 'FAIL: a member wrote a sample by changing it';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.runner_samples where runner_id = '00000000-0000-4000-8000-0000021021a1';
    raise exception 'FAIL: a member wrote a sample by deleting it';
  exception when insufficient_privilege then null; end;
  begin
    update public.runners set health = '{"cpu": 1}' where id = '00000000-0000-4000-8000-0000021021a1';
    raise exception 'FAIL: a member wrote a runner''s health';
  exception when insufficient_privilege then null; end;
  begin
    update public.runner_jobs set tokens = '{"input": 1, "output": 1, "cacheRead": 1, "cacheWrite": 1}' where id = '00000000-0000-4000-8000-0000021022a1';
    raise exception 'FAIL: a member wrote a job''s tokens';
  exception when insufficient_privilege then null; end;
end $$;

-- An account of another workspace reads nothing.
select pg_temp.sign_in('00000000-0000-4000-8000-0000021020e1');
do $$
begin
  if exists (select 1 from public.runner_samples where workspace_id = '00000000-0000-4000-8000-000002102001') then
    raise exception 'FAIL: another workspace read the runner samples';
  end if;
  if exists (select 1 from public.runners where id = '00000000-0000-4000-8000-0000021021a1') then
    raise exception 'FAIL: another workspace read a runner''s health';
  end if;
  if exists (select 1 from public.runner_jobs where id = '00000000-0000-4000-8000-0000021022a1') then
    raise exception 'FAIL: another workspace read a job''s tokens';
  end if;
end $$;
reset role;

-- ── Adding and trimming, as the service role ──
set local role service_role;
do $$
declare
  box     constant uuid := '00000000-0000-4000-8000-0000021021a1';
  old_box constant uuid := '00000000-0000-4000-8000-0000021021b1';
  taken   constant timestamptz := now() - interval '15 seconds';
begin
  -- A sample at an instant the runner already holds is held once, as first sent.
  insert into public.runner_samples (runner_id, workspace_id, at, cpu)
  values (box, '00000000-0000-4000-8000-000002102001', taken, 1)
  on conflict (runner_id, at) do nothing;
  if (select count(*) from public.runner_samples where runner_id = box) <> 2
     or (select cpu from public.runner_samples where runner_id = box and at = taken) <> 63.5 then
    raise exception 'FAIL: a sample sent again was not held once, as first sent';
  end if;
  -- A figure out of range is refused.
  begin
    insert into public.runner_samples (runner_id, workspace_id, cpu) values (box, '00000000-0000-4000-8000-000002102001', 100.5);
    raise exception 'FAIL: a CPU above 100 was stored';
  exception when check_violation then null; end;
  begin
    insert into public.runner_samples (runner_id, workspace_id, mem_used) values (box, '00000000-0000-4000-8000-000002102001', -1);
    raise exception 'FAIL: a negative memory was stored';
  exception when check_violation then null; end;
  -- The route's trim: one runner's samples older than an hour go, its recent one and the other runner's stay.
  delete from public.runner_samples where runner_id = box and at < now() - interval '1 hour';
  if exists (select 1 from public.runner_samples where runner_id = box and at < now() - interval '1 hour')
     or (select count(*) from public.runner_samples where runner_id = box) <> 1
     or (select count(*) from public.runner_samples where runner_id = old_box) <> 1 then
    raise exception 'FAIL: the trim deleted the wrong samples';
  end if;
  -- The route stores the last health.
  update public.runners set health = '{"cpu": null, "at": "2026-10-16T12:00:15.000Z"}' where id = box;
  -- The route stores a job's tokens, and a job that never had any keeps none.
  update public.runner_jobs set tokens = '{"input": 50, "output": 60, "cacheRead": 70, "cacheWrite": 80}' where id = '00000000-0000-4000-8000-0000021022a1';
  if (select (tokens ->> 'input')::integer from public.runner_jobs where id = '00000000-0000-4000-8000-0000021022a1') <> 50 then
    raise exception 'FAIL: the route did not store a job''s tokens';
  end if;
end $$;
reset role;

-- Deleting a runner deletes its samples.
delete from public.runners where id = '00000000-0000-4000-8000-0000021021a1';
do $$
begin
  if exists (select 1 from public.runner_samples where runner_id = '00000000-0000-4000-8000-0000021021a1') then
    raise exception 'FAIL: a deleted runner kept its samples';
  end if;
end $$;

rollback;

select 'runner_samples: every check passed' as result;
