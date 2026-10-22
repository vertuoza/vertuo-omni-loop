-- Who may read and write the waits (PRD 2377). The supabase workflow runs it on every pull request,
-- after `supabase db start` has applied the migrations:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/waits.sql
-- The service role opens, refreshes and ends waits; a row keeps its since and its end, a wait has one
-- open row, and an ended one is kept. A member reads their own workspace's rows; a member of another
-- workspace, an account in no workspace and anyone signed out read nothing, and no role but the service
-- role writes. One transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

-- The checks' own workspace, Initech, with its fleets, sectors and repositories (PRD 2305).
\ir fixtures/initech.sql

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'ada@example.com'),
  ('00000000-0000-4000-8000-0000000000c1', 'carl@acme.test'),
  ('00000000-0000-4000-8000-0000000000e1', 'eve@example.com');
-- A second workspace, Acme. Ada belongs to Initech, Carl to Acme, Eve to none.
insert into public.workspaces (slug, name, github_org) values ('acme', 'Acme', 'acme');
insert into public.workspace_members (workspace_id, user_id, joined_at)
select w.id, m.user_id, now() - interval '1 day'
  from (values
         ('initech', '00000000-0000-4000-8000-0000000000a1'::uuid),
         ('acme',    '00000000-0000-4000-8000-0000000000c1'::uuid)
       ) as m (slug, user_id)
  join public.workspaces w on w.slug = m.slug;

create function pg_temp.sign_in(uid text, email text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'email', email, 'role', 'authenticated')::text, true);
$$;

-- ── The service role opens, refreshes and ends; since and an end are kept ──
set local role service_role;
do $$
declare
  initech uuid := (select id from public.workspaces where slug = 'initech');
  acme    uuid := (select id from public.workspaces where slug = 'acme');
  review  uuid;
begin
  insert into public.waits (workspace_id, repo, prd, pr, kind, turn, since, seen_at) values
    (initech, 'initech/nimbus-plan', 7,    9,    'review',   '{ada,initech/core}', '2026-10-01T09:00:00Z', '2026-10-01T09:00:00Z'),
    (initech, 'initech/nimbus-plan', null, 5,    'merge',    '{}',                 '2026-10-02T09:00:00Z', '2026-10-02T09:00:00Z'),
    (initech, 'initech/nimbus-plan', 8,    null, 'approval', '{ada}',              '2026-10-03T09:00:00Z', '2026-10-03T09:00:00Z'),
    (acme,    'acme/widgets',        3,    4,    'review',   '{carl}',             '2026-10-04T09:00:00Z', '2026-10-04T09:00:00Z');
  review := (select id from public.waits where workspace_id = initech and pr = 9 and kind = 'review');

  -- A refresh, as the sync writes it: an upsert of the whole row, which moves turn and seen_at only.
  insert into public.waits (id, workspace_id, repo, prd, pr, kind, turn, since, seen_at)
  values (review, initech, 'initech/nimbus-plan', 7, 9, 'review', '{ada,bob}', '2026-10-09T09:00:00Z', '2026-10-09T09:00:00Z')
  on conflict (id) do update set turn = excluded.turn, since = excluded.since, seen_at = excluded.seen_at;
  if (select since from public.waits where id = review) <> '2026-10-01T09:00:00Z' then
    raise exception 'FAIL: a refresh moved a wait''s since';
  end if;
  if (select turn from public.waits where id = review) <> '{ada,bob}' or (select seen_at from public.waits where id = review) <> '2026-10-09T09:00:00Z' then
    raise exception 'FAIL: a refresh did not move a wait''s turn and seen_at';
  end if;
  update public.waits set kind = 'merge', pr = 10, since = '2026-01-01T00:00:00Z' where id = review;
  if (select (kind, pr, since) from public.waits where id = review) <> ('review'::text, 9, '2026-10-01T09:00:00Z'::timestamptz) then
    raise exception 'FAIL: an update changed what a wait is, or its since';
  end if;

  begin
    insert into public.waits (workspace_id, repo, prd, pr, kind, since, seen_at)
    values (initech, 'initech/nimbus-plan', 7, 9, 'review', now(), now());
    raise exception 'FAIL: a wait had two open rows';
  exception when unique_violation then null; end;
  begin
    insert into public.waits (workspace_id, repo, prd, pr, kind, since, seen_at)
    values (initech, 'initech/nimbus-plan', null, 5, 'merge', now(), now());
    raise exception 'FAIL: a wait with no PRD had two open rows';
  exception when unique_violation then null; end;

  -- Ended: kept, never reopened, and the same wait seen again opens a new row.
  update public.waits set ended_at = '2026-10-10T09:00:00Z' where id = review;
  update public.waits set ended_at = null where id = review;
  if (select ended_at from public.waits where id = review) is distinct from '2026-10-10T09:00:00Z' then
    raise exception 'FAIL: an ended wait was reopened';
  end if;
  insert into public.waits (workspace_id, repo, prd, pr, kind, since, seen_at)
  values (initech, 'initech/nimbus-plan', 7, 9, 'review', '2026-10-11T09:00:00Z', '2026-10-11T09:00:00Z');
  if (select count(*) from public.waits where workspace_id = initech and pr = 9) <> 2 then
    raise exception 'FAIL: a wait seen again after it ended did not open a new row';
  end if;

  begin
    insert into public.waits (workspace_id, repo, prd, pr, kind, since, seen_at) values (initech, 'initech/nimbus-plan', 7, 9, 'stuck', now(), now());
    raise exception 'FAIL: an unknown kind was stored';
  exception when check_violation then null; end;
  begin
    insert into public.waits (workspace_id, repo, prd, pr, kind, since, seen_at) values (initech, 'initech/nimbus-plan', 7, 9, 'approval', now(), now());
    raise exception 'FAIL: an approval was stored on a pull request';
  exception when check_violation then null; end;
  begin
    insert into public.waits (workspace_id, repo, prd, pr, kind, since, seen_at) values (initech, 'initech/nimbus-plan', null, 9, 'outbox', now(), now());
    raise exception 'FAIL: an outbox wait was stored with no PRD';
  exception when check_violation then null; end;
  begin
    insert into public.waits (workspace_id, repo, prd, pr, kind, since, seen_at) values (initech, 'Initech/Nimbus-Plan', 7, 11, 'review', now(), now());
    raise exception 'FAIL: a repository was stored in upper case';
  exception when check_violation then null; end;
  begin
    delete from public.waits;
    raise exception 'FAIL: the service role deleted a wait';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Signed out: nothing ──
set local role anon;
do $$
begin
  begin perform 1 from public.waits limit 1; raise exception 'FAIL: anon read the waits';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Ada, a member: reads her workspace's rows only, and writes nothing ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000a1', 'ada@example.com');
do $$
begin
  if (select count(*) from public.waits) <> 4 or exists (select 1 from public.waits where repo = 'acme/widgets') then
    raise exception 'FAIL: a member did not read exactly their workspace''s waits';
  end if;
  begin
    insert into public.waits (workspace_id, repo, prd, pr, kind, since, seen_at)
    values ((select id from public.workspaces where slug = 'initech'), 'initech/nimbus-plan', 7, 12, 'review', now(), now());
    raise exception 'FAIL: a member opened a wait';
  exception when insufficient_privilege then null; end;
  begin
    update public.waits set ended_at = now();
    raise exception 'FAIL: a member ended a wait';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.waits;
    raise exception 'FAIL: a member deleted a wait';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Carl, of another workspace: reads only Acme's ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000c1', 'carl@acme.test');
do $$
begin
  if (select count(*) from public.waits) <> 1 or exists (select 1 from public.waits where repo <> 'acme/widgets') then
    raise exception 'FAIL: a member of another workspace read Initech''s waits';
  end if;
end $$;
reset role;

-- ── Eve, in no workspace: nothing ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000e1', 'eve@example.com');
do $$
begin
  if exists (select 1 from public.waits) then
    raise exception 'FAIL: an account in no workspace read a wait';
  end if;
end $$;
reset role;

-- ── Grants: no role but the service role writes ──
do $$
begin
  if has_table_privilege('authenticated', 'public.waits', 'insert, update, delete, truncate') then
    raise exception 'FAIL: the signed-in may write the waits';
  end if;
  if has_table_privilege('anon', 'public.waits', 'select, insert, update, delete, truncate') then
    raise exception 'FAIL: anon may touch the waits';
  end if;
  if has_table_privilege('service_role', 'public.waits', 'delete, truncate') then
    raise exception 'FAIL: the service role may delete waits';
  end if;
end $$;

select 'waits checks passed' as result;
rollback;
