-- Who may read and write the releases (PRD 262). The supabase workflow runs it on every pull request,
-- after `supabase db start` has applied the migrations:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/releases.sql
-- The first table anyone may read. Signed out (anon) or signed in (authenticated), everyone reads every
-- release, and nobody inserts, updates or deletes one. Only the service role writes, as the sync
-- (pnpm releases:sync) does: it adds releases and refreshes their title and description, and never
-- renumbers, redates or deletes one. Release 1, the initial release, is shared by many PRDs; a release
-- above 1 belongs to one PRD alone. One transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

-- Act as a signed-in account for the rest of the transaction: the claims of its access token.
create function pg_temp.sign_in(uid text, email text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'email', email, 'role', 'authenticated')::text, true);
$$;

-- Reads every release, and writes none: what anyone on the internet may do, signed in or not.
create function pg_temp.reads_every_release_and_writes_none(who text) returns void language plpgsql as $$
begin
  if (select count(*) from public.releases) <> 4
     or (select title from public.releases where prd = 262) <> 'Every release, week by week' then
    raise exception 'FAIL: % did not read every release', who;
  end if;
  begin
    insert into public.releases (prd, release, released_at, title) values (999, 99, now(), 'Planted');
    raise exception 'FAIL: % added a release', who;
  exception when insufficient_privilege then null; end;
  begin
    update public.releases set title = 'Defaced' where prd = 262;
    raise exception 'FAIL: % changed a release', who;
  exception when insufficient_privilege then null; end;
  begin
    delete from public.releases where prd = 262;
    raise exception 'FAIL: % deleted a release', who;
  exception when insufficient_privilege then null; end;
  begin
    truncate public.releases;
    raise exception 'FAIL: % emptied the releases', who;
  exception when insufficient_privilege then null; end;
end;
$$;

-- ── The service role, as the sync: adds releases and refreshes their text, nothing more ──
set local role service_role;
do $$
declare
  n int;
begin
  insert into public.releases (prd, release, released_at, title, description) values
    (3,   1, '2026-09-25 13:17:33+00', 'Install the delivery loop in any repository', 'The kit packages the loop as one tool.'),
    (7,   1, '2026-09-25 13:17:33+00', 'Brainstorm, build and ship with three commands', 'The plugin gives the loop its commands.'),
    (262, 2, '2026-09-28 09:15:00+00', 'Know what shipped, week by week', '');
  -- A PRD shipped with no note: its spec's title, and the description's default.
  insert into public.releases (prd, release, released_at, title) values (270, 3, '2026-09-29 09:15:00+00', 'The next PRD');
  if (select description from public.releases where prd = 270) is distinct from '' then
    raise exception 'FAIL: a release added with no description did not default to an empty one';
  end if;

  update public.releases set title = 'Every release, week by week', description = 'A public page lists every release.' where prd = 262;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: the service role did not refresh a release''s text'; end if;

  begin
    update public.releases set release = 9 where prd = 262;
    raise exception 'FAIL: the service role renumbered a release';
  exception when insufficient_privilege then null; end;
  begin
    update public.releases set released_at = now() where prd = 262;
    raise exception 'FAIL: the service role redated a release';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.releases where prd = 270;
    raise exception 'FAIL: the service role deleted a release';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Signed out: reads every release, writes none ──
set local role anon;
select pg_temp.reads_every_release_and_writes_none('anon');
reset role;

-- ── Signed in: the same, no more ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000a1', 'ada@vertuoza.com');
select pg_temp.reads_every_release_and_writes_none('a signed-in account');
reset role;

-- ── Release 1 is shared; a release above 1 belongs to one PRD ──
set local role service_role;
do $$
begin
  insert into public.releases (prd, release, released_at, title) values (28, 1, '2026-09-25 13:17:33+00', 'Every open question, visible on the pull request');
  if (select count(*) from public.releases where release = 1) <> 3 then
    raise exception 'FAIL: a third PRD could not join the initial release';
  end if;
  begin
    insert into public.releases (prd, release, released_at, title) values (280, 2, now(), 'A second PRD on 0.0.2');
    raise exception 'FAIL: two PRDs shared the release 2';
  exception when unique_violation then null; end;
  begin
    insert into public.releases (prd, release, released_at, title) values (262, 4, now(), 'The same PRD twice');
    raise exception 'FAIL: one PRD took two releases';
  exception when unique_violation then null; end;
  begin
    insert into public.releases (prd, release, released_at, title) values (281, 0, now(), 'Release zero');
    raise exception 'FAIL: a release below 1 was added';
  exception when check_violation then null; end;
  begin
    insert into public.releases (prd, release, released_at, title) values (282, 5, now(), '  ');
    raise exception 'FAIL: a release with an empty title was added';
  exception when check_violation then null; end;
end $$;
reset role;

-- ── Row-level security is on, with one policy: anyone reads. The grants say the same: anon and the
-- signed-in hold select and nothing else, so a stray grant is caught even where the policy would stop it ──
do $$
declare
  who text;
  what text;
begin
  foreach who in array array['anon', 'authenticated'] loop
    if not has_table_privilege(who, 'public.releases', 'select') then
      raise exception 'FAIL: % is not granted select on public.releases', who;
    end if;
    foreach what in array array['insert', 'update', 'delete', 'truncate', 'references', 'trigger'] loop
      if has_table_privilege(who, 'public.releases', what)
         or (what in ('insert', 'update', 'references') and has_any_column_privilege(who, 'public.releases', what)) then
        raise exception 'FAIL: % is granted % on public.releases', who, what;
      end if;
    end loop;
  end loop;
  if not (select c.relrowsecurity from pg_class c where c.oid = 'public.releases'::regclass) then
    raise exception 'FAIL: row-level security is off on public.releases';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'releases') <> 1
     or not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'releases'
                     and cmd = 'SELECT' and roles @> array['anon', 'authenticated']::name[] and qual = 'true') then
    raise exception 'FAIL: public.releases has another policy than one select for anon and authenticated';
  end if;
end $$;

select 'release checks passed' as result;
rollback;
