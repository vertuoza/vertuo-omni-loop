-- Who may read and write the PRD stages (PRD 587). The supabase workflow runs it on every pull request,
-- after `supabase db start` has applied the migrations:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/prd_stages.sql
-- The service role records stages and topics; a second write of a stage keeps its first date and only
-- refreshes synced_at. A member reads their own workspace's rows; a member of another workspace, an
-- account in no workspace and anyone signed out read nothing, and nobody signed in writes. One
-- transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'ada@vertuoza.com'),
  ('00000000-0000-4000-8000-0000000000c1', 'carl@acme.test'),
  ('00000000-0000-4000-8000-0000000000e1', 'eve@example.com');
-- A second workspace, Acme. Ada belongs to Vertuoza, Carl to Acme, Eve to none.
insert into public.workspaces (slug, name, github_org) values ('acme', 'Acme', 'acme');
insert into public.workspace_members (workspace_id, user_id, joined_at)
select w.id, m.user_id, now() - interval '1 day'
  from (values
         ('vertuoza', '00000000-0000-4000-8000-0000000000a1'::uuid),
         ('acme',     '00000000-0000-4000-8000-0000000000c1'::uuid)
       ) as m (slug, user_id)
  join public.workspaces w on w.slug = m.slug;

create function pg_temp.sign_in(uid text, email text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'email', email, 'role', 'authenticated')::text, true);
$$;

-- ── The service role records, and a second write keeps the first date ──
set local role service_role;
do $$
declare
  vertuoza uuid := (select id from public.workspaces where slug = 'vertuoza');
  acme     uuid := (select id from public.workspaces where slug = 'acme');
begin
  insert into public.prd_stages (workspace_id, repository, prd, stage, reached_at, synced_at) values
    (vertuoza, 'vertuoza/vertuo-omni-loop', 7, 'prd',   '2026-09-01T09:00:00Z', '2026-09-01T09:00:00Z'),
    (vertuoza, 'vertuoza/vertuo-omni-loop', 7, 'inbox', '2026-09-02T09:00:00Z', '2026-09-02T09:00:00Z'),
    (acme,     'acme/widgets',              3, 'prd',   '2026-09-03T09:00:00Z', '2026-09-03T09:00:00Z');
  insert into public.prd_topics (workspace_id, repository, prd, topic) values
    (vertuoza, 'vertuoza/vertuo-omni-loop', 7, 'team-inbox'),
    (acme,     'acme/widgets',              3, 'widgets');

  -- The same stage again, as the sync or an event writes it: an upsert.
  insert into public.prd_stages (workspace_id, repository, prd, stage, reached_at, synced_at)
  values (vertuoza, 'vertuoza/vertuo-omni-loop', 7, 'inbox', '2026-09-20T09:00:00Z', '2026-09-20T09:00:00Z')
  on conflict (workspace_id, repository, prd, stage)
  do update set reached_at = excluded.reached_at, synced_at = excluded.synced_at;
  if (select reached_at from public.prd_stages where workspace_id = vertuoza and prd = 7 and stage = 'inbox') <> '2026-09-02T09:00:00Z' then
    raise exception 'FAIL: a second write of a stage moved its date';
  end if;
  if (select synced_at from public.prd_stages where workspace_id = vertuoza and prd = 7 and stage = 'inbox') <> '2026-09-20T09:00:00Z' then
    raise exception 'FAIL: a second write of a stage did not refresh synced_at';
  end if;
  update public.prd_stages set reached_at = '2026-01-01T00:00:00Z' where workspace_id = vertuoza and prd = 7 and stage = 'prd';
  if (select reached_at from public.prd_stages where workspace_id = vertuoza and prd = 7 and stage = 'prd') <> '2026-09-01T09:00:00Z' then
    raise exception 'FAIL: an update moved a stage''s date';
  end if;
  if (select count(*) from public.prd_stages) <> 3 then
    raise exception 'FAIL: a second write of a stage added a row';
  end if;

  begin
    insert into public.prd_stages (workspace_id, repository, prd, stage, reached_at) values (vertuoza, 'vertuoza/vertuo-omni-loop', 7, 'idea', now());
    raise exception 'FAIL: idea was stored';
  exception when check_violation then null; end;
  begin
    insert into public.prd_stages (workspace_id, repository, prd, stage, reached_at) values (vertuoza, 'Vertuoza/Vertuo-Omni-Loop', 8, 'prd', now());
    raise exception 'FAIL: a repository was stored in upper case';
  exception when check_violation then null; end;
  begin
    insert into public.prd_topics (workspace_id, repository, prd, topic) values (vertuoza, 'vertuoza/vertuo-omni-loop', 8, 'team-inbox');
    raise exception 'FAIL: two PRDs of one repository took the same topic';
  exception when unique_violation then null; end;
  begin
    delete from public.prd_stages;
    raise exception 'FAIL: the service role deleted a stage';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Signed out: nothing ──
set local role anon;
do $$
begin
  begin perform 1 from public.prd_stages limit 1; raise exception 'FAIL: anon read the stages';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.prd_topics limit 1; raise exception 'FAIL: anon read the topics';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Ada, a member: reads her workspace's rows only, and writes nothing ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000a1', 'ada@vertuoza.com');
do $$
begin
  if (select count(*) from public.prd_stages) <> 2 or exists (select 1 from public.prd_stages where repository = 'acme/widgets') then
    raise exception 'FAIL: a member did not read exactly their workspace''s stages';
  end if;
  if (select count(*) from public.prd_topics) <> 1 or (select topic from public.prd_topics) <> 'team-inbox' then
    raise exception 'FAIL: a member did not read exactly their workspace''s topics';
  end if;
  begin
    insert into public.prd_stages (workspace_id, repository, prd, stage, reached_at)
    values ((select id from public.workspaces where slug = 'vertuoza'), 'vertuoza/vertuo-omni-loop', 7, 'shipped', now());
    raise exception 'FAIL: a member recorded a stage';
  exception when insufficient_privilege then null; end;
  begin
    update public.prd_stages set synced_at = now();
    raise exception 'FAIL: a member refreshed a stage';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.prd_stages;
    raise exception 'FAIL: a member deleted a stage';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.prd_topics (workspace_id, repository, prd, topic)
    values ((select id from public.workspaces where slug = 'vertuoza'), 'vertuoza/vertuo-omni-loop', 9, 'forged');
    raise exception 'FAIL: a member recorded a topic';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Carl, of another workspace: reads only Acme's ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000c1', 'carl@acme.test');
do $$
begin
  if exists (select 1 from public.prd_stages where repository <> 'acme/widgets')
     or exists (select 1 from public.prd_topics where repository <> 'acme/widgets') then
    raise exception 'FAIL: a member of another workspace read Vertuoza''s stages or topics';
  end if;
end $$;
reset role;

-- ── Eve, in no workspace: nothing ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000e1', 'eve@example.com');
do $$
begin
  if exists (select 1 from public.prd_stages) or exists (select 1 from public.prd_topics) then
    raise exception 'FAIL: an account in no workspace read a stage or a topic';
  end if;
end $$;
reset role;

-- ── Grants ──
do $$
begin
  if has_table_privilege('authenticated', 'public.prd_stages', 'insert, update, delete, truncate')
     or has_table_privilege('authenticated', 'public.prd_topics', 'insert, update, delete, truncate') then
    raise exception 'FAIL: the signed-in may write the stages or the topics';
  end if;
  if has_table_privilege('anon', 'public.prd_stages', 'select, insert, update, delete')
     or has_table_privilege('anon', 'public.prd_topics', 'select, insert, update, delete') then
    raise exception 'FAIL: anon may touch the stages or the topics';
  end if;
  if has_table_privilege('service_role', 'public.prd_stages', 'delete, truncate')
     or has_table_privilege('service_role', 'public.prd_topics', 'delete, truncate') then
    raise exception 'FAIL: the service role may delete stages or topics';
  end if;
end $$;

select 'prd stages checks passed' as result;
rollback;
