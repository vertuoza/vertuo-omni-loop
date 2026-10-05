-- Who may read and write the GitHub snapshots (PRD 902, s2). Run it after `supabase db start` has
-- applied the migrations:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/dossier_github.sql
-- The service role stores a PRD's snapshot, marks it stale, leases its refresh and refreshes it in
-- place. A member reads their own workspace's rows; a member of another workspace, an account in no
-- workspace and anyone signed out read nothing, and nobody signed in writes. A row goes with its
-- dossier. One transaction, rolled back at the end. Any `FAIL:` stops the run.

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

-- Three PRD dossiers: two of Vertuoza's, one of Acme's.
insert into public.dossiers (id, workspace_id, home_repo, kind, prd, title, numbered_at)
select d.id, w.id, d.repo, 'prd', d.prd, d.title, now()
  from (values
         ('00000000-0000-4000-8000-00000000d901'::uuid, 'vertuoza', 'vertuoza/vertuo-omni-loop', 901, 'Call GitHub only when needed'),
         ('00000000-0000-4000-8000-00000000d902'::uuid, 'vertuoza', 'vertuoza/vertuo-omni-loop', 902, 'Pages read a snapshot'),
         ('00000000-0000-4000-8000-00000000d903'::uuid, 'acme',     'acme/widgets',              3,   'Widgets')
       ) as d (id, slug, repo, prd, title)
  join public.workspaces w on w.slug = d.slug;

create function pg_temp.sign_in(uid text, email text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'email', email, 'role', 'authenticated')::text, true);
$$;

-- ── The service role stores, marks stale, leases and refreshes in place ──
set local role service_role;
do $$
declare
  vertuoza uuid := (select id from public.workspaces where slug = 'vertuoza');
  acme     uuid := (select id from public.workspaces where slug = 'acme');
  leased   int;
begin
  insert into public.dossier_github (dossier_id, workspace_id, summary, read_at) values
    ('00000000-0000-4000-8000-00000000d901', vertuoza, '{"repo":"vertuoza/vertuo-omni-loop","prd":901,"issue":"unread"}', '2026-10-01T09:00:00Z'),
    ('00000000-0000-4000-8000-00000000d902', vertuoza, '{"repo":"vertuoza/vertuo-omni-loop","prd":902,"issue":null}', '2026-10-01T09:00:00Z'),
    ('00000000-0000-4000-8000-00000000d903', acme,     '{"repo":"acme/widgets","prd":3,"issue":null}', '2026-10-01T09:00:00Z');

  -- Something moved on GitHub: the snapshot is marked stale, once.
  update public.dossier_github set stale_since = '2026-10-01T09:05:00Z'
   where dossier_id = '00000000-0000-4000-8000-00000000d901' and stale_since is null;

  -- One refresh takes the lease; a second one, while it holds, takes nothing.
  update public.dossier_github set refreshing_until = '2026-10-01T09:06:00Z'
   where dossier_id = '00000000-0000-4000-8000-00000000d901'
     and (refreshing_until is null or refreshing_until < '2026-10-01T09:05:10Z');
  get diagnostics leased = row_count;
  if leased <> 1 then raise exception 'FAIL: a refresh could not take a free lease'; end if;
  update public.dossier_github set refreshing_until = '2026-10-01T09:06:20Z'
   where dossier_id = '00000000-0000-4000-8000-00000000d901'
     and (refreshing_until is null or refreshing_until < '2026-10-01T09:05:20Z');
  get diagnostics leased = row_count;
  if leased <> 0 then raise exception 'FAIL: a second refresh took a lease that was held'; end if;

  -- The refresh writes what it read, as an upsert, and clears the stale mark and the lease.
  insert into public.dossier_github (dossier_id, workspace_id, summary, read_at, refreshing_until)
  values ('00000000-0000-4000-8000-00000000d901', vertuoza, '{"repo":"vertuoza/vertuo-omni-loop","prd":901,"issue":null}', '2026-10-01T09:05:30Z', null)
  on conflict (dossier_id)
  do update set summary = excluded.summary, read_at = excluded.read_at, refreshing_until = excluded.refreshing_until;
  update public.dossier_github set stale_since = null
   where dossier_id = '00000000-0000-4000-8000-00000000d901' and stale_since <= '2026-10-01T09:05:10Z';
  if (select summary ->> 'issue' from public.dossier_github where dossier_id = '00000000-0000-4000-8000-00000000d901') is not null
     or (select stale_since from public.dossier_github where dossier_id = '00000000-0000-4000-8000-00000000d901') is not null
     or (select refreshing_until from public.dossier_github where dossier_id = '00000000-0000-4000-8000-00000000d901') is not null then
    raise exception 'FAIL: a refresh did not replace the snapshot';
  end if;
  if (select count(*) from public.dossier_github) <> 3 then
    raise exception 'FAIL: a refresh added a row';
  end if;

  begin
    insert into public.dossier_github (dossier_id, workspace_id, summary) values ('00000000-0000-4000-8000-00000000d9ff', vertuoza, '{}');
    raise exception 'FAIL: a snapshot was stored for no dossier';
  exception when foreign_key_violation then null; end;
  begin
    update public.dossier_github set summary = '[]' where dossier_id = '00000000-0000-4000-8000-00000000d902';
    raise exception 'FAIL: a snapshot was stored as something else than an object';
  exception when check_violation then null; end;
  begin
    delete from public.dossier_github;
    raise exception 'FAIL: the service role deleted a snapshot';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Signed out: nothing ──
set local role anon;
do $$
begin
  begin perform 1 from public.dossier_github limit 1; raise exception 'FAIL: anon read the GitHub snapshots';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Ada, a member: reads her workspace's rows only, and writes nothing ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000a1', 'ada@vertuoza.com');
do $$
begin
  if (select count(*) from public.dossier_github) <> 2
     or exists (select 1 from public.dossier_github where dossier_id = '00000000-0000-4000-8000-00000000d903') then
    raise exception 'FAIL: a member did not read exactly their workspace''s GitHub snapshots';
  end if;
  begin
    insert into public.dossier_github (dossier_id, workspace_id, summary)
    values ('00000000-0000-4000-8000-00000000d903', (select id from public.workspaces where slug = 'vertuoza'), '{}');
    raise exception 'FAIL: a member stored a GitHub snapshot';
  exception when insufficient_privilege then null; end;
  begin
    update public.dossier_github set stale_since = now();
    raise exception 'FAIL: a member marked a GitHub snapshot stale';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.dossier_github;
    raise exception 'FAIL: a member deleted a GitHub snapshot';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Carl, of another workspace: reads only Acme's ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000c1', 'carl@acme.test');
do $$
begin
  if (select count(*) from public.dossier_github) <> 1
     or exists (select 1 from public.dossier_github where dossier_id <> '00000000-0000-4000-8000-00000000d903') then
    raise exception 'FAIL: a member of another workspace read Vertuoza''s GitHub snapshots';
  end if;
end $$;
reset role;

-- ── Eve, in no workspace: nothing ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000e1', 'eve@example.com');
do $$
begin
  if exists (select 1 from public.dossier_github) then
    raise exception 'FAIL: an account in no workspace read a GitHub snapshot';
  end if;
end $$;
reset role;

-- ── A row goes with its dossier ──
delete from public.dossiers where id = '00000000-0000-4000-8000-00000000d902';
do $$
begin
  if exists (select 1 from public.dossier_github where dossier_id = '00000000-0000-4000-8000-00000000d902') then
    raise exception 'FAIL: a dossier''s GitHub snapshot outlived it';
  end if;
end $$;

-- ── Grants ──
do $$
begin
  if has_table_privilege('authenticated', 'public.dossier_github', 'insert, update, delete, truncate') then
    raise exception 'FAIL: the signed-in may write the GitHub snapshots';
  end if;
  if has_table_privilege('anon', 'public.dossier_github', 'select, insert, update, delete') then
    raise exception 'FAIL: anon may touch the GitHub snapshots';
  end if;
  if has_table_privilege('service_role', 'public.dossier_github', 'delete, truncate') then
    raise exception 'FAIL: the service role may delete GitHub snapshots';
  end if;
end $$;

select 'GitHub snapshot checks passed' as result;
rollback;
