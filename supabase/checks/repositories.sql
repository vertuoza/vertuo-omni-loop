-- Who may read and write a workspace's repositories and their pull request statistics (PRD 612). The
-- supabase workflow runs it on every pull request, after `supabase db start` has applied the
-- migrations and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/repositories.sql
-- A workspace's owner, and only its owner, adds a repository and switches its tracking through
-- add_repository() and set_repository_tracked(): a member, the owner of another workspace and anyone
-- signed out are refused (42501), and nothing changes. Every member reads the workspace's
-- repositories, pull requests and reviews; a stranger reads none of them. Nobody signed in or signed
-- out writes any of the three tables directly. The seed of 20261008090000_repositories.sql gives
-- vertuoza its six tracked repositories, and no other workspace anything. One transaction, rolled back
-- at the end. Any `FAIL:` stops the run.

begin;

-- ── The seed, before anyone touches anything ──
do $$
declare
  got text;
begin
  select string_agg(r.full_name || ':' || r.tracked, ',' order by r.full_name) into got
    from public.repositories r join public.workspaces w on w.id = r.workspace_id where w.slug = 'vertuoza';
  if got is distinct from 'vertuoza/pdf-builder:true,vertuoza/vertuo-ai-domain:true,vertuoza/vertuo-apps:true,'
                          'vertuoza/vertuo-backend-php:true,vertuoza/vertuo-omni-loop:true,vertuoza/vertuo-workflow-domain:true' then
    raise exception 'FAIL: vertuoza was not seeded with its six tracked repositories: %', got;
  end if;
  if exists (select 1 from public.repositories r join public.workspaces w on w.id = r.workspace_id where w.slug <> 'vertuoza') then
    raise exception 'FAIL: a workspace other than vertuoza was seeded with repositories';
  end if;
end $$;

-- ── The cast ──
-- Olga owns Vertuoza and Mo is a member of it; Carl owns Acme, which starts with no repository; Sam
-- belongs to no workspace.
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000061a1', 'olga@vertuoza.com', now()),
  ('00000000-0000-4000-8000-0000000061b1', 'mo@vertuoza.com', now()),
  ('00000000-0000-4000-8000-0000000061c1', 'carl@acme.test', now()),
  ('00000000-0000-4000-8000-0000000061d1', 'sam@nowhere.test', now());
insert into public.workspaces (slug, name, github_org) values ('acme-repos', 'Acme', 'acme-repos');
insert into public.workspace_members (workspace_id, user_id, role)
select w.id, m.user_id, m.role
  from (values
         ('vertuoza',   '00000000-0000-4000-8000-0000000061a1'::uuid, 'owner'),
         ('vertuoza',   '00000000-0000-4000-8000-0000000061b1'::uuid, 'member'),
         ('acme-repos', '00000000-0000-4000-8000-0000000061c1'::uuid, 'owner')
       ) as m (slug, user_id, role)
  join public.workspaces w on w.slug = m.slug;

-- A new workspace starts with an empty list.
do $$
begin
  if exists (select 1 from public.repositories r join public.workspaces w on w.id = r.workspace_id where w.slug = 'acme-repos') then
    raise exception 'FAIL: a new workspace starts with repositories';
  end if;
end $$;

-- What the collector (the service role) writes: one pull request with one review, on Vertuoza's
-- vertuo-apps.
insert into public.pull_requests (workspace_id, repo, number, author, opened_at, merged_at, merged_by, base, commits, additions, deletions, omni_signed)
select w.id, 'vertuoza/vertuo-apps', 7, 'mo', now() - interval '2 days', now() - interval '1 day', 'olga', 'main', 3, 40, 2, true
  from public.workspaces w where w.slug = 'vertuoza';
insert into public.pull_request_reviews (workspace_id, repo, number, reviewer, first_at)
select w.id, 'vertuoza/vertuo-apps', 7, 'olga', now() - interval '36 hours'
  from public.workspaces w where w.slug = 'vertuoza';

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
-- The workspaces' ids, read here once: a signed-in account reads only its own workspaces.
create temporary table ids (slug text primary key, id uuid);
insert into ids select w.slug, w.id from public.workspaces w where w.slug in ('vertuoza', 'acme-repos');
grant select on ids to anon, authenticated, service_role;
create function pg_temp.ws(slug text) returns uuid language sql as $$
  select i.id from ids i where i.slug = ws.slug;
$$;
-- The workspace's repositories, as one value to compare before and after a refusal.
create function pg_temp.repos(slug text) returns text language sql as $$
  select coalesce(string_agg(row(r.*)::text, ';' order by r.full_name), '')
    from public.repositories r join public.workspaces w on w.id = r.workspace_id where w.slug = repos.slug;
$$;
-- Runs a call that must be refused to its caller.
create function pg_temp.forbidden(stmt text, who text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % ran for %', stmt, who;
exception when insufficient_privilege then null;
end;
$$;

create temporary table repos_before (slug text primary key, repos text);
insert into repos_before select s, pg_temp.repos(s) from unnest(array['vertuoza', 'acme-repos']) s;

-- The calls every outsider tries, on Vertuoza's list.
create temporary table calls (stmt text);
insert into calls
select format(c, pg_temp.ws('vertuoza'))
  from unnest(array[
    'select public.add_repository(%L, ''vertuoza/planted'')',
    'select public.set_repository_tracked(%L, ''vertuoza/vertuo-apps'', false)'
  ]) c;
grant select on calls to anon, authenticated;

-- The direct writes nobody may make, whoever they are.
create temporary table writes (stmt text);
insert into writes
select format(c, pg_temp.ws('vertuoza'))
  from unnest(array[
    'insert into public.repositories (workspace_id, full_name) values (%L, ''vertuoza/planted'')',
    'update public.repositories set tracked = false where workspace_id = %L',
    'update public.repositories set collect_error = ''x'' where workspace_id = %L',
    'delete from public.repositories where workspace_id = %L',
    'insert into public.pull_requests (workspace_id, repo, number, opened_at) values (%L, ''vertuoza/vertuo-apps'', 8, now())',
    'update public.pull_requests set commits = 99 where workspace_id = %L',
    'delete from public.pull_requests where workspace_id = %L',
    'insert into public.pull_request_reviews (workspace_id, repo, number, reviewer, first_at) values (%L, ''vertuoza/vertuo-apps'', 7, ''mo'', now())',
    'update public.pull_request_reviews set reviewer = ''x'' where workspace_id = %L',
    'delete from public.pull_request_reviews where workspace_id = %L'
  ]) c;
grant select on writes to anon, authenticated;

-- ── Signed out: every function and every write refused, nothing read ──
set local role anon;
do $$
declare c text;
begin
  for c in select stmt from calls loop perform pg_temp.forbidden(c, 'anon'); end loop;
  for c in select stmt from writes loop perform pg_temp.forbidden(c, 'anon'); end loop;
  begin perform 1 from public.repositories; raise exception 'FAIL: anon read public.repositories';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.pull_requests; raise exception 'FAIL: anon read public.pull_requests';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.pull_request_reviews; raise exception 'FAIL: anon read public.pull_request_reviews';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── A member of Vertuoza: reads everything of Vertuoza's, changes nothing ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000061b1');
do $$
declare c text;
begin
  if (select count(*) from public.repositories where workspace_id = pg_temp.ws('vertuoza')) <> 6 then
    raise exception 'FAIL: a member does not read their workspace''s six repositories';
  end if;
  if (select count(*) from public.pull_requests) <> 1 or (select count(*) from public.pull_request_reviews) <> 1 then
    raise exception 'FAIL: a member does not read their workspace''s pull requests and reviews';
  end if;
  for c in select stmt from calls loop perform pg_temp.forbidden(c, 'a member'); end loop;
  for c in select stmt from writes loop perform pg_temp.forbidden(c, 'a member'); end loop;
end $$;

-- ── Acme's owner: refused on Vertuoza's list, reads nothing of it ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000000061c1');
do $$
declare c text;
begin
  for c in select stmt from calls loop perform pg_temp.forbidden(c, 'the owner of another workspace'); end loop;
  if exists (select 1 from public.repositories) or exists (select 1 from public.pull_requests) or exists (select 1 from public.pull_request_reviews) then
    raise exception 'FAIL: the owner of another workspace reads Vertuoza''s repositories or statistics';
  end if;
end $$;

-- ── An account in no workspace: refused, reads nothing ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000000061d1');
do $$
declare c text;
begin
  for c in select stmt from calls loop perform pg_temp.forbidden(c, 'a stranger'); end loop;
  if exists (select 1 from public.repositories) or exists (select 1 from public.pull_requests) or exists (select 1 from public.pull_request_reviews) then
    raise exception 'FAIL: a stranger reads repositories or statistics';
  end if;
end $$;
reset role;

do $$
begin
  if pg_temp.repos('vertuoza') <> (select repos from repos_before where slug = 'vertuoza') then
    raise exception 'FAIL: a refused call changed Vertuoza''s repositories';
  end if;
  if has_table_privilege('authenticated', 'public.repositories', 'insert') or has_table_privilege('authenticated', 'public.repositories', 'update')
     or has_table_privilege('authenticated', 'public.pull_requests', 'insert') or has_table_privilege('authenticated', 'public.pull_request_reviews', 'insert') then
    raise exception 'FAIL: authenticated holds a write grant on a repositories table';
  end if;
end $$;

-- ── The owner: writes nothing directly, adds and switches through the functions ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000061a1');
do $$
declare
  c text;
  r public.repositories;
begin
  for c in select stmt from writes loop perform pg_temp.forbidden(c, 'the owner, directly'); end loop;

  r := public.add_repository(pg_temp.ws('vertuoza'), '  Vertuoza/New-Thing ');
  if r.full_name <> 'vertuoza/new-thing' or not r.tracked or r.added_by <> '00000000-0000-4000-8000-0000000061a1'::uuid then
    raise exception 'FAIL: add_repository did not add vertuoza/new-thing tracked, by its owner: %', r;
  end if;
  r := public.add_repository(pg_temp.ws('vertuoza'), 'vertuoza/new-thing');
  if (select count(*) from public.repositories where full_name = 'vertuoza/new-thing') <> 1 then
    raise exception 'FAIL: adding a listed repository again made a second row';
  end if;

  begin
    perform public.add_repository(pg_temp.ws('vertuoza'), 'not a repository');
    raise exception 'FAIL: add_repository took a name that is not owner/name';
  exception when invalid_parameter_value then null; end;

  r := public.set_repository_tracked(pg_temp.ws('vertuoza'), 'vertuoza/vertuo-apps', false);
  if r.tracked then raise exception 'FAIL: set_repository_tracked did not switch tracking off'; end if;
  if (select count(*) from public.pull_requests where repo = 'vertuoza/vertuo-apps') <> 1 then
    raise exception 'FAIL: switching tracking off lost the repository''s pull requests';
  end if;
  r := public.set_repository_tracked(pg_temp.ws('vertuoza'), 'vertuoza/vertuo-apps', true);
  if not r.tracked then raise exception 'FAIL: set_repository_tracked did not switch tracking back on'; end if;

  begin
    perform public.set_repository_tracked(pg_temp.ws('vertuoza'), 'vertuoza/missing', false);
    raise exception 'FAIL: set_repository_tracked switched a repository that is not listed';
  exception when no_data_found then null; end;

  -- Olga owns Vertuoza only.
  begin
    perform public.add_repository(pg_temp.ws('acme-repos'), 'acme-repos/widgets');
    raise exception 'FAIL: Vertuoza''s owner added a repository to Acme';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── The service role writes the collection columns only ──
set local role service_role;
do $$
begin
  update public.repositories set collected_at = now(), collected_until = now(), collect_error = null
   where workspace_id = pg_temp.ws('vertuoza') and full_name = 'vertuoza/vertuo-apps';
  begin
    update public.repositories set tracked = false where workspace_id = pg_temp.ws('vertuoza');
    raise exception 'FAIL: the service role switched tracking directly';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

rollback;

\echo 'repositories: every check passed'
