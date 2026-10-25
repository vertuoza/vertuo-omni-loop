-- What the database keeps of the problems a bug fix saw and did not fix (PRD 2508), run after
-- `supabase db start` has applied the migrations:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/bug_fix_follow_ups.sql
-- As the service role: a new job reads `[]`; `follow_ups` takes a list of up to five entries and refuses a
-- sixth, and any value that is not a list (an object, a string, a number, null). A member of the workspace
-- reads the column with the row, a member of another workspace reads none of it, nobody signed in writes
-- it and nobody signed out reads it. Any `FAIL:` stops the run.

begin;

-- ── The cast ──
-- Olga owns the workspace Follow ups; Eve owns another one.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000025080a1', 'olga@followups.test'),
  ('00000000-0000-4000-8000-0000025080e1', 'eve@elsewhere.test');
insert into public.workspaces (id, slug, name, github_org) values
  ('00000000-0000-4000-8000-000002508001', 'followups-check', 'Follow ups', 'followups-check'),
  ('00000000-0000-4000-8000-000002508002', 'followups-elsewhere', 'Elsewhere', 'followups-elsewhere');
insert into public.workspace_members (workspace_id, user_id, role) values
  ('00000000-0000-4000-8000-000002508001', '00000000-0000-4000-8000-0000025080a1', 'owner'),
  ('00000000-0000-4000-8000-000002508002', '00000000-0000-4000-8000-0000025080e1', 'owner');

-- F1 holds no follow-up, F2 holds two; X1 belongs to the other workspace.
insert into public.runner_jobs (id, workspace_id, line, repo, sent_by, status)
values
  ('00000000-0000-4000-8000-0000025082a1', '00000000-0000-4000-8000-000002508001', '/omni:bug-fix #501', 'followups-check/app', '00000000-0000-4000-8000-0000025080a1', 'queued'),
  ('00000000-0000-4000-8000-0000025082a2', '00000000-0000-4000-8000-000002508001', '/omni:bug-fix #502', 'followups-check/app', '00000000-0000-4000-8000-0000025080a1', 'queued'),
  ('00000000-0000-4000-8000-0000025082b1', '00000000-0000-4000-8000-000002508002', '/omni:bug-fix #503', 'followups-elsewhere/app', '00000000-0000-4000-8000-0000025080e1', 'queued');

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- ── What the service role may store ──
set local role service_role;
do $$
declare
  one  constant jsonb := '{"repos":["demo-org/app"],"summary":"A log line says the check sends data the service rejects."}';
  v    jsonb;
begin
  -- A job nobody reported on reads an empty list.
  if (select follow_ups from public.runner_jobs where id = '00000000-0000-4000-8000-0000025082a1') <> '[]'::jsonb then
    raise exception 'FAIL: a new job did not read []';
  end if;

  -- From none to five entries, each count accepted.
  for i in 0..5 loop
    update public.runner_jobs
       set follow_ups = (select coalesce(jsonb_agg(one), '[]'::jsonb) from generate_series(1, i))
     where id = '00000000-0000-4000-8000-0000025082a1';
  end loop;

  -- A sixth entry is refused, on an update and on an insert.
  begin
    update public.runner_jobs
       set follow_ups = (select jsonb_agg(one) from generate_series(1, 6))
     where id = '00000000-0000-4000-8000-0000025082a1';
    raise exception 'FAIL: a sixth follow-up was stored';
  exception when check_violation then null; end;
  begin
    insert into public.runner_jobs (workspace_id, line, repo, sent_by, follow_ups)
    values ('00000000-0000-4000-8000-000002508001', '/omni:bug-fix #504', 'followups-check/app',
            '00000000-0000-4000-8000-0000025080a1', (select jsonb_agg(one) from generate_series(1, 6)));
    raise exception 'FAIL: a job was inserted with six follow-ups';
  exception when check_violation then null; end;

  -- A value that is not a list is refused.
  foreach v in array array['{"repos":["demo-org/app"],"summary":"x"}', '"a string"', '7', 'true', 'null']::jsonb[] loop
    begin
      update public.runner_jobs set follow_ups = v where id = '00000000-0000-4000-8000-0000025082a1';
      raise exception 'FAIL: % was stored as follow_ups', v;
    exception when check_violation then null; end;
  end loop;
  begin
    update public.runner_jobs set follow_ups = null where id = '00000000-0000-4000-8000-0000025082a1';
    raise exception 'FAIL: a null follow_ups was stored';
  exception when not_null_violation then null; end;

  -- The column of the job holds what was last stored: F1 ends on five, F2 and X1 are set for the reads below.
  update public.runner_jobs set follow_ups = jsonb_build_array(one, one) where id = '00000000-0000-4000-8000-0000025082a2';
  update public.runner_jobs set follow_ups = jsonb_build_array(one) where id = '00000000-0000-4000-8000-0000025082b1';
  if (select jsonb_array_length(follow_ups) from public.runner_jobs where id = '00000000-0000-4000-8000-0000025082a1') <> 5 then
    raise exception 'FAIL: a refused write changed the stored follow-ups';
  end if;
end $$;
reset role;

-- ── Signed out: nothing ──
set local role anon;
do $$
begin
  begin perform follow_ups from public.runner_jobs limit 1; raise exception 'FAIL: anon read the follow-ups';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── A member reads; nobody signed in writes ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000025080a1');
do $$
begin
  if (select jsonb_array_length(follow_ups) from public.runner_jobs where id = '00000000-0000-4000-8000-0000025082a2') <> 2 then
    raise exception 'FAIL: a member did not read their workspace''s follow-ups';
  end if;
  if exists (select 1 from public.runner_jobs where id = '00000000-0000-4000-8000-0000025082b1') then
    raise exception 'FAIL: a member read another workspace''s job';
  end if;
  begin update public.runner_jobs set follow_ups = '[]' where id = '00000000-0000-4000-8000-0000025082a2';
    raise exception 'FAIL: a member wrote a job''s follow-ups';
  exception when insufficient_privilege then null; end;
  begin update public.runner_jobs set follow_ups = '[]' where id = '00000000-0000-4000-8000-0000025082b1';
    raise exception 'FAIL: a member wrote the follow-ups of another workspace''s job';
  exception when insufficient_privilege then null; end;
end $$;

-- A member of another workspace reads none of it.
select pg_temp.sign_in('00000000-0000-4000-8000-0000025080e1');
do $$
begin
  if exists (select 1 from public.runner_jobs where workspace_id = '00000000-0000-4000-8000-000002508001') then
    raise exception 'FAIL: another workspace read a job and its follow-ups';
  end if;
  if (select jsonb_array_length(follow_ups) from public.runner_jobs where id = '00000000-0000-4000-8000-0000025082b1') <> 1 then
    raise exception 'FAIL: Eve did not read her own workspace''s follow-ups';
  end if;
end $$;
reset role;

rollback;

select 'bug_fix_follow_ups: every check passed' as result;
