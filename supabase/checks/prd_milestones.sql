-- Who may read and write a PRD's milestones, and which time a second write keeps (PRD 2370). The
-- supabase workflow runs it on every pull request, after `supabase db start` has applied the migrations:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/prd_milestones.sql
-- The service role records milestones; a second write keeps the first time and pull request and only
-- refreshes synced_at, but a later last-slice moves it (an earlier one does not). A member reads their
-- own workspace's rows; a member of another workspace, an account in no workspace and anyone signed out
-- read nothing, and nobody signed in writes. One transaction, rolled back at the end. Any `FAIL:` stops
-- the run.

begin;

-- The checks' own workspace, Initech, with its fleets, sectors and repositories (PRD 2305).
\ir fixtures/initech.sql

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000023a1', 'ada@example.com'),
  ('00000000-0000-4000-8000-0000000023c1', 'carl@acme.test'),
  ('00000000-0000-4000-8000-0000000023e1', 'eve@example.com');
-- A second workspace, Acme. Ada belongs to Initech, Carl to Acme, Eve to none.
insert into public.workspaces (slug, name, github_org) values ('acme', 'Acme', 'acme');
insert into public.workspace_members (workspace_id, user_id, joined_at)
select w.id, m.user_id, now() - interval '1 day'
  from (values
         ('initech', '00000000-0000-4000-8000-0000000023a1'::uuid),
         ('acme',    '00000000-0000-4000-8000-0000000023c1'::uuid)
       ) as m (slug, user_id)
  join public.workspaces w on w.slug = m.slug;

create function pg_temp.sign_in(uid text, email text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'email', email, 'role', 'authenticated')::text, true);
$$;

-- ── The service role records; the first time wins, and last-slice only moves later ──
set local role service_role;
do $$
declare
  initech uuid := (select id from public.workspaces where slug = 'initech');
  acme    uuid := (select id from public.workspaces where slug = 'acme');
begin
  insert into public.prd_milestones (workspace_id, repository, prd, lane, milestone, pr, reached_at, synced_at) values
    (initech, 'initech/nimbus-plan', 7, 'initech/nimbus-plan', 'approved',    null, '2026-09-01T09:00:00Z', '2026-09-01T09:00:00Z'),
    (initech, 'initech/nimbus-plan', 7, 'initech/nimbus-plan', 'opened',      12,   '2026-09-02T09:00:00Z', '2026-09-02T09:00:00Z'),
    (initech, 'initech/nimbus-plan', 7, 'initech/nimbus-plan', 'last-slice',  14,   '2026-09-05T09:00:00Z', '2026-09-05T09:00:00Z'),
    (acme,    'acme/widgets',        3, 'acme/widgets',        'merged',      21,   '2026-09-03T09:00:00Z', '2026-09-03T09:00:00Z');

  -- The same milestone again, as the sync writes it: an upsert with another time and pull request.
  insert into public.prd_milestones (workspace_id, repository, prd, lane, milestone, pr, reached_at, synced_at)
  values (initech, 'initech/nimbus-plan', 7, 'initech/nimbus-plan', 'opened', 13, '2026-09-20T09:00:00Z', '2026-09-20T09:00:00Z')
  on conflict (workspace_id, repository, prd, lane, milestone)
  do update set pr = excluded.pr, reached_at = excluded.reached_at, synced_at = excluded.synced_at;
  if (select reached_at from public.prd_milestones where workspace_id = initech and prd = 7 and milestone = 'opened') <> '2026-09-02T09:00:00Z' then
    raise exception 'FAIL: a second write of a milestone moved its time';
  end if;
  if (select pr from public.prd_milestones where workspace_id = initech and prd = 7 and milestone = 'opened') <> 12 then
    raise exception 'FAIL: a second write of a milestone changed its pull request';
  end if;
  if (select synced_at from public.prd_milestones where workspace_id = initech and prd = 7 and milestone = 'opened') <> '2026-09-20T09:00:00Z' then
    raise exception 'FAIL: a second write of a milestone did not refresh synced_at';
  end if;
  update public.prd_milestones set reached_at = '2026-01-01T00:00:00Z' where workspace_id = initech and prd = 7 and milestone = 'approved';
  if (select reached_at from public.prd_milestones where workspace_id = initech and prd = 7 and milestone = 'approved') <> '2026-09-01T09:00:00Z' then
    raise exception 'FAIL: an update moved a milestone''s time';
  end if;

  -- last-slice: an earlier one keeps the stored time, a later one (a rework slice) moves it.
  insert into public.prd_milestones (workspace_id, repository, prd, lane, milestone, pr, reached_at)
  values (initech, 'initech/nimbus-plan', 7, 'initech/nimbus-plan', 'last-slice', 13, '2026-09-04T09:00:00Z')
  on conflict (workspace_id, repository, prd, lane, milestone)
  do update set pr = excluded.pr, reached_at = excluded.reached_at, synced_at = excluded.synced_at;
  if (select (pr, reached_at) from public.prd_milestones where workspace_id = initech and prd = 7 and milestone = 'last-slice')
     is distinct from (14, '2026-09-05T09:00:00Z'::timestamptz) then
    raise exception 'FAIL: an earlier last-slice moved it back';
  end if;
  insert into public.prd_milestones (workspace_id, repository, prd, lane, milestone, pr, reached_at)
  values (initech, 'initech/nimbus-plan', 7, 'initech/nimbus-plan', 'last-slice', 18, '2026-09-09T09:00:00Z')
  on conflict (workspace_id, repository, prd, lane, milestone)
  do update set pr = excluded.pr, reached_at = excluded.reached_at, synced_at = excluded.synced_at;
  if (select (pr, reached_at) from public.prd_milestones where workspace_id = initech and prd = 7 and milestone = 'last-slice')
     is distinct from (18, '2026-09-09T09:00:00Z'::timestamptz) then
    raise exception 'FAIL: a later last-slice did not move it';
  end if;
  if (select count(*) from public.prd_milestones) <> 4 then
    raise exception 'FAIL: a second write of a milestone added a row';
  end if;

  begin
    insert into public.prd_milestones (workspace_id, repository, prd, lane, milestone, pr, reached_at)
    values (initech, 'initech/nimbus-plan', 7, 'initech/nimbus-plan', 'deployed', 12, now());
    raise exception 'FAIL: a milestone the timeline does not know was stored';
  exception when check_violation then null; end;
  begin
    insert into public.prd_milestones (workspace_id, repository, prd, lane, milestone, pr, reached_at)
    values (initech, 'initech/nimbus-plan', 8, 'Initech/Nimbus-Plan', 'opened', 12, now());
    raise exception 'FAIL: a lane was stored in upper case';
  exception when check_violation then null; end;
  begin
    insert into public.prd_milestones (workspace_id, repository, prd, lane, milestone, pr, reached_at)
    values (initech, 'initech/nimbus-plan', 8, 'initech/nimbus-plan', 'merged', null, now());
    raise exception 'FAIL: a lane milestone was stored without its pull request';
  exception when check_violation then null; end;
  begin
    insert into public.prd_milestones (workspace_id, repository, prd, lane, milestone, pr, reached_at)
    values (initech, 'initech/nimbus-plan', 8, 'initech/nimbus-plan', 'approved', 12, now());
    raise exception 'FAIL: a PRD milestone was stored with a pull request';
  exception when check_violation then null; end;
  begin
    delete from public.prd_milestones;
    raise exception 'FAIL: the service role deleted a milestone';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Signed out: nothing ──
set local role anon;
do $$
begin
  begin perform 1 from public.prd_milestones limit 1; raise exception 'FAIL: anon read the milestones';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Ada, a member: reads her workspace's rows only, and writes nothing ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000023a1', 'ada@example.com');
do $$
begin
  if (select count(*) from public.prd_milestones) <> 3 or exists (select 1 from public.prd_milestones where repository = 'acme/widgets') then
    raise exception 'FAIL: a member did not read exactly their workspace''s milestones';
  end if;
  begin
    insert into public.prd_milestones (workspace_id, repository, prd, lane, milestone, pr, reached_at)
    values ((select id from public.workspaces where slug = 'initech'), 'initech/nimbus-plan', 7, 'initech/nimbus-plan', 'merged', 19, now());
    raise exception 'FAIL: a member recorded a milestone';
  exception when insufficient_privilege then null; end;
  begin
    update public.prd_milestones set synced_at = now();
    raise exception 'FAIL: a member refreshed a milestone';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.prd_milestones;
    raise exception 'FAIL: a member deleted a milestone';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Carl, of another workspace: reads only Acme's ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000023c1', 'carl@acme.test');
do $$
begin
  if (select count(*) from public.prd_milestones) <> 1 or exists (select 1 from public.prd_milestones where repository <> 'acme/widgets') then
    raise exception 'FAIL: a member of another workspace read Initech''s milestones';
  end if;
end $$;
reset role;

-- ── Eve, in no workspace: nothing ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000023e1', 'eve@example.com');
do $$
begin
  if exists (select 1 from public.prd_milestones) then
    raise exception 'FAIL: an account in no workspace read a milestone';
  end if;
end $$;
reset role;

-- ── Grants ──
do $$
begin
  if has_table_privilege('authenticated', 'public.prd_milestones', 'insert, update, delete, truncate') then
    raise exception 'FAIL: the signed-in may write the milestones';
  end if;
  if has_table_privilege('anon', 'public.prd_milestones', 'select, insert, update, delete') then
    raise exception 'FAIL: anon may touch the milestones';
  end if;
  if has_table_privilege('service_role', 'public.prd_milestones', 'delete, truncate') then
    raise exception 'FAIL: the service role may delete milestones';
  end if;
end $$;

select 'prd milestones checks passed' as result;
rollback;
