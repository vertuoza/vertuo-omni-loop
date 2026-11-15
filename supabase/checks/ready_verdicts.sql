-- Who may read and write the ready verdicts (PRD 2898 s7). The supabase workflow runs it on every pull
-- request, after `supabase db start` has applied the migrations:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/ready_verdicts.sql
-- The service role saves a verdict per pull request and head commit, a second save on the same commit
-- rewriting it, and the table refuses a verdict out of shape (ready without five passes, not four checks
-- nor six, a head that is no SHA, a repository in upper case, a state it does not know, a link that is not
-- https). A member reads their own workspace's verdicts only; a member of another workspace, an account in
-- no workspace and anyone signed out read nothing, and nobody signed in writes the table. One transaction,
-- rolled back at the end. Any `FAIL:` stops the run.

begin;

-- The checks' own workspace, Initech, with its fleets, sectors and repositories (PRD 2305).
\ir fixtures/initech.sql

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000028a1', 'ada@example.com'),
  ('00000000-0000-4000-8000-0000000028c1', 'carl@acme.test'),
  ('00000000-0000-4000-8000-0000000028e1', 'eve@example.com');
-- A second workspace, Acme. Ada belongs to Initech, Carl to Acme, Eve to none.
insert into public.workspaces (slug, name, github_org) values ('acme', 'Acme', 'acme');
insert into public.workspace_members (workspace_id, user_id, joined_at)
select w.id, m.user_id, now() - interval '1 day'
  from (values
         ('initech', '00000000-0000-4000-8000-0000000028a1'::uuid),
         ('acme',    '00000000-0000-4000-8000-0000000028c1'::uuid)
       ) as m (slug, user_id)
  join public.workspaces w on w.slug = m.slug;

select set_config('ready_verdicts.initech', (select id::text from public.workspaces where slug = 'initech'), true),
       set_config('ready_verdicts.acme', (select id::text from public.workspaces where slug = 'acme'), true);

create function pg_temp.sign_in(uid text, email text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'email', email, 'role', 'authenticated')::text, true);
$$;

-- Five checks, each passing; `pg_temp.checks(n)` holds n of them.
create function pg_temp.checks(n integer) returns jsonb language sql as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', 'c' || i, 'title', 'a check', 'state', 'pass', 'why', 'it passed', 'evidence', null, 'excused', '[]'::jsonb)), '[]'::jsonb)
    from generate_series(1, n) i;
$$;

-- ── The service role: saves, rewrites, and the table's refusals ──
set local role service_role;
do $$
declare
  initech uuid := current_setting('ready_verdicts.initech')::uuid;
  acme    uuid := current_setting('ready_verdicts.acme')::uuid;
  head    text := repeat('a1', 20);
begin
  insert into public.ready_verdicts (workspace_id, repo, prd, pr_number, head_sha, state, passed, headline, checks, check_url)
  values (initech, 'initech/nimbus-plan', 2898, 31, head, 'not finished', 3, 'Not finished · 3 of 5 · CI green on the latest commit: not finished',
          pg_temp.checks(5), 'https://github.com/initech/nimbus-plan/runs/1');
  insert into public.ready_verdicts (workspace_id, repo, prd, pr_number, head_sha, state, passed, headline, checks, criteria)
  values (acme, 'acme/widgets', 7, 12, head, 'not ready', 4, 'Not ready · 4 of 5 · No test was loosened: fail', pg_temp.checks(5),
          '[{"number": 1, "kind": "test", "scenario": "A total", "lines": ["Scenario: A total"], "proof": null, "state": null}]');

  -- The same pull request and commit again: the row is rewritten, never doubled.
  insert into public.ready_verdicts as v (workspace_id, repo, prd, pr_number, head_sha, state, passed, headline, checks)
  values (initech, 'initech/nimbus-plan', 2898, 31, head, 'ready', 5, 'Ready for review · 5 of 5', pg_temp.checks(5))
  on conflict (workspace_id, repo, pr_number, head_sha) do update
     set state = excluded.state, passed = excluded.passed, headline = excluded.headline, checks = excluded.checks;
  if (select count(*) from public.ready_verdicts where workspace_id = initech) <> 1
     or (select state from public.ready_verdicts where workspace_id = initech) <> 'ready' then
    raise exception 'FAIL: a second save on the same commit did not rewrite the verdict';
  end if;

  begin
    insert into public.ready_verdicts (workspace_id, repo, prd, pr_number, head_sha, state, passed, headline, checks)
    values (initech, 'initech/nimbus-plan', 2898, 31, repeat('b2', 20), 'ready', 4, 'Ready for review · 4 of 5', pg_temp.checks(5));
    raise exception 'FAIL: a verdict was ready with four passes';
  exception when check_violation then null; end;
  begin
    insert into public.ready_verdicts (workspace_id, repo, prd, pr_number, head_sha, state, passed, headline, checks)
    values (initech, 'initech/nimbus-plan', 2898, 31, repeat('b2', 20), 'not ready', 5, 'Not ready · 5 of 5', pg_temp.checks(5));
    raise exception 'FAIL: a verdict passed all five checks and was not ready';
  exception when check_violation then null; end;
  begin
    insert into public.ready_verdicts (workspace_id, repo, prd, pr_number, head_sha, state, passed, headline, checks)
    values (initech, 'initech/nimbus-plan', 2898, 31, repeat('b2', 20), 'not ready', 3, 'Not ready · 3 of 4', pg_temp.checks(4));
    raise exception 'FAIL: a verdict of four checks was stored';
  exception when check_violation then null; end;
  begin
    insert into public.ready_verdicts (workspace_id, repo, prd, pr_number, head_sha, state, passed, headline, checks)
    values (initech, 'initech/nimbus-plan', 2898, 31, 'main', 'not ready', 3, 'Not ready · 3 of 5', pg_temp.checks(5));
    raise exception 'FAIL: a head that is no SHA was stored';
  exception when check_violation then null; end;
  begin
    insert into public.ready_verdicts (workspace_id, repo, prd, pr_number, head_sha, state, passed, headline, checks)
    values (initech, 'Initech/Nimbus-Plan', 2898, 31, repeat('b2', 20), 'not ready', 3, 'Not ready · 3 of 5', pg_temp.checks(5));
    raise exception 'FAIL: a repository was stored in upper case';
  exception when check_violation then null; end;
  begin
    insert into public.ready_verdicts (workspace_id, repo, prd, pr_number, head_sha, state, passed, headline, checks)
    values (initech, 'initech/nimbus-plan', 2898, 31, repeat('b2', 20), 'merged', 3, 'Merged', pg_temp.checks(5));
    raise exception 'FAIL: a state the verdict does not know was stored';
  exception when check_violation then null; end;
  begin
    insert into public.ready_verdicts (workspace_id, repo, prd, pr_number, head_sha, state, passed, headline, checks, check_url)
    values (initech, 'initech/nimbus-plan', 2898, 31, repeat('b2', 20), 'not ready', 3, 'Not ready · 3 of 5', pg_temp.checks(5), 'javascript:alert(1)');
    raise exception 'FAIL: a check link that is not https was stored';
  exception when check_violation then null; end;
end $$;
reset role;

-- ── Anyone signed out: reads nothing ──
set local role anon;
do $$
begin
  begin perform 1 from public.ready_verdicts limit 1; raise exception 'FAIL: anon read the ready verdicts';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Ada, a member: reads her workspace's verdicts only, writes none ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000028a1', 'ada@example.com');
do $$
declare
  initech uuid := current_setting('ready_verdicts.initech')::uuid;
begin
  if (select count(*) from public.ready_verdicts) <> 1 or exists (select 1 from public.ready_verdicts where repo = 'acme/widgets') then
    raise exception 'FAIL: a member did not read exactly their workspace''s verdicts';
  end if;
  if (select passed from public.ready_verdicts) <> 5 then
    raise exception 'FAIL: a member did not read the latest verdict of the commit';
  end if;
  begin
    insert into public.ready_verdicts (workspace_id, repo, prd, pr_number, head_sha, state, passed, headline, checks)
    values (initech, 'initech/nimbus-plan', 2898, 32, repeat('c3', 20), 'ready', 5, 'Ready for review · 5 of 5', pg_temp.checks(5));
    raise exception 'FAIL: a member saved a verdict';
  exception when insufficient_privilege then null; end;
  begin
    update public.ready_verdicts set state = 'not ready', passed = 4;
    raise exception 'FAIL: a member changed a verdict';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.ready_verdicts;
    raise exception 'FAIL: a member deleted a verdict';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Carl, a member of Acme: reads Acme's verdict only ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000028c1', 'carl@acme.test');
do $$
begin
  if (select count(*) from public.ready_verdicts) <> 1 or (select repo from public.ready_verdicts) <> 'acme/widgets' then
    raise exception 'FAIL: a member of another workspace read Initech''s verdict, or not their own';
  end if;
end $$;
reset role;

-- ── Eve, in no workspace: reads nothing ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000028e1', 'eve@example.com');
do $$
begin
  if exists (select 1 from public.ready_verdicts) then
    raise exception 'FAIL: an account in no workspace read a verdict';
  end if;
end $$;
reset role;

rollback;

select 'ready_verdicts: every check passed' as result;
