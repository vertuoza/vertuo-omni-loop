-- Who may read and write a workspace's repositories and their pull request statistics (PRD 612). The
-- supabase workflow runs it on every pull request, after `supabase db start` has applied the
-- migrations and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/repositories.sql
-- A workspace's owner, and only its owner, adds a repository and switches its tracking through
-- add_repository() and set_repository_tracked(): a member, the owner of another workspace and anyone
-- signed out are refused (42501), and nothing changes. Every member reads the workspace's
-- repositories, pull requests and reviews; a stranger reads none of them. Nobody signed in or signed
-- out writes any of the three tables directly. A fresh install tracks no repository: the migrations
-- seed none, and neither does the demo seed (PRD 2305). A repository's products are
-- its product_repositories links alone: repositories.product_id and everything that wrote it are gone
-- (PRD 1364). The owner, and only the owner, removes a repository through remove_repository() (PRD
-- 2188): it is hidden (removed_at), untracked and its board private; the products that link it lose the
-- link, every consumes drops it, a product that plans in it has no plan repository; its ideas, pull
-- requests and knowledge packs stay. Removing it twice answers it as it is; adding it again lists it,
-- tracked; a removed repository cannot be linked or set as a plan repository. One transaction, rolled
-- back at the end. Any `FAIL:` stops the run.

begin;

-- ── A fresh install, before anyone touches anything: no repository (PRD 2305) ──
do $$
begin
  if exists (select 1 from public.repositories) then
    raise exception 'FAIL: a fresh install tracks a repository nobody added: %',
      (select string_agg(full_name, ',' order by full_name) from public.repositories);
  end if;
end $$;

-- The checks' own workspace, Initech, with its fleets, sectors and repositories (PRD 2305).
\ir fixtures/initech.sql

-- ── A repository's products are its links alone (PRD 1364, landing 3) ──
-- repositories.product_id, the repositories_default_product trigger and repository_set_product() are
-- gone, with the repositories_product_link trigger that kept the links in step with the column.
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'repositories' and column_name = 'product_id') then
    raise exception 'FAIL: repositories.product_id is still there';
  end if;
  if exists (select 1 from pg_trigger t where t.tgrelid = 'public.repositories'::regclass
              and t.tgname in ('repositories_default_product', 'repositories_product_link')) then
    raise exception 'FAIL: a trigger that wrote or followed repositories.product_id is still there';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public'
                and p.proname in ('repository_set_product', 'repositories_default_product', 'repositories_product_link')) then
    raise exception 'FAIL: repository_set_product() or a trigger function of repositories.product_id is still there';
  end if;
end $$;

-- ── The cast ──
-- Olga owns Initech and Mo is a member of it; Carl owns Acme, which starts with no repository; Sam
-- belongs to no workspace.
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000061a1', 'olga@example.com', now()),
  ('00000000-0000-4000-8000-0000000061b1', 'mo@example.com', now()),
  ('00000000-0000-4000-8000-0000000061c1', 'carl@acme.test', now()),
  ('00000000-0000-4000-8000-0000000061d1', 'sam@nowhere.test', now());
insert into public.workspaces (slug, name, github_org) values ('acme-repos', 'Acme', 'acme-repos');
insert into public.workspace_members (workspace_id, user_id, role)
select w.id, m.user_id, m.role
  from (values
         ('initech',   '00000000-0000-4000-8000-0000000061a1'::uuid, 'owner'),
         ('initech',   '00000000-0000-4000-8000-0000000061b1'::uuid, 'member'),
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

-- What the collector (the service role) writes: one pull request with one review, on Initech's
-- nimbus-apps.
insert into public.pull_requests (workspace_id, repo, number, author, opened_at, merged_at, merged_by, base, commits, additions, deletions, omni_signed,
                                  head, draft, labels, head_committed_at, needs_fix_at, status_state)
select w.id, 'initech/nimbus-apps', 7, 'mo', now() - interval '2 days', now() - interval '1 day', 'olga', 'main', 3, 40, 2, true,
       'feat/thing', false, array['omni:needs-fix'], now() - interval '30 hours', now() - interval '40 hours', 'done'
  from public.workspaces w where w.slug = 'initech';
insert into public.pull_request_reviews (workspace_id, repo, number, reviewer, first_at)
select w.id, 'initech/nimbus-apps', 7, 'olga', now() - interval '36 hours'
  from public.workspaces w where w.slug = 'initech';

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
-- The workspaces' ids, read here once: a signed-in account reads only its own workspaces.
create temporary table ids (slug text primary key, id uuid);
insert into ids select w.slug, w.id from public.workspaces w where w.slug in ('initech', 'acme-repos');
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
insert into repos_before select s, pg_temp.repos(s) from unnest(array['initech', 'acme-repos']) s;

-- The calls every outsider tries, on Initech's list.
create temporary table calls (stmt text);
insert into calls
select format(c, pg_temp.ws('initech'))
  from unnest(array[
    'select public.add_repository(%L, ''initech/planted'')',
    'select public.set_repository_tracked(%L, ''initech/nimbus-apps'', false)',
    'select public.remove_repository(%L, ''initech/nimbus-apps'')'
  ]) c;
grant select on calls to anon, authenticated;

-- The direct writes nobody may make, whoever they are.
create temporary table writes (stmt text);
insert into writes
select format(c, pg_temp.ws('initech'))
  from unnest(array[
    'insert into public.repositories (workspace_id, full_name) values (%L, ''initech/planted'')',
    'update public.repositories set tracked = false where workspace_id = %L',
    'update public.repositories set collect_error = ''x'' where workspace_id = %L',
    'delete from public.repositories where workspace_id = %L',
    'insert into public.pull_requests (workspace_id, repo, number, opened_at) values (%L, ''initech/nimbus-apps'', 8, now())',
    'update public.pull_requests set commits = 99 where workspace_id = %L',
    'update public.pull_requests set head = ''x'', draft = true, labels = ''{x}'', head_committed_at = now(), needs_fix_at = now(), status_state = ''stuck'' where workspace_id = %L',
    'delete from public.pull_requests where workspace_id = %L',
    'insert into public.pull_request_reviews (workspace_id, repo, number, reviewer, first_at) values (%L, ''initech/nimbus-apps'', 7, ''mo'', now())',
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

-- ── A member of Initech: reads everything of Initech's, changes nothing ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000061b1');
do $$
declare c text;
begin
  if (select count(*) from public.repositories where workspace_id = pg_temp.ws('initech')) <> 6 then
    raise exception 'FAIL: a member does not read their workspace''s six repositories';
  end if;
  if (select count(*) from public.pull_requests) <> 1 or (select count(*) from public.pull_request_reviews) <> 1 then
    raise exception 'FAIL: a member does not read their workspace''s pull requests and reviews';
  end if;
  -- The six columns of PRD 714.
  if (select count(*) from public.pull_requests
       where head = 'feat/thing' and not draft and labels = array['omni:needs-fix'] and head_committed_at is not null
         and needs_fix_at is not null and status_state = 'done') <> 1 then
    raise exception 'FAIL: a member does not read the loop-health columns of their workspace''s pull requests';
  end if;
  for c in select stmt from calls loop perform pg_temp.forbidden(c, 'a member'); end loop;
  for c in select stmt from writes loop perform pg_temp.forbidden(c, 'a member'); end loop;
end $$;

-- ── Acme's owner: refused on Initech's list, reads nothing of it ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000000061c1');
do $$
declare c text;
begin
  for c in select stmt from calls loop perform pg_temp.forbidden(c, 'the owner of another workspace'); end loop;
  if exists (select 1 from public.repositories) or exists (select 1 from public.pull_requests) or exists (select 1 from public.pull_request_reviews) then
    raise exception 'FAIL: the owner of another workspace reads Initech''s repositories or statistics';
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
  if exists (select head, draft, labels, head_committed_at, needs_fix_at, status_state from public.pull_requests) then
    raise exception 'FAIL: a stranger reads the loop-health columns';
  end if;
end $$;
reset role;

do $$
begin
  if pg_temp.repos('initech') <> (select repos from repos_before where slug = 'initech') then
    raise exception 'FAIL: a refused call changed Initech''s repositories';
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

  r := public.add_repository(pg_temp.ws('initech'), '  Initech/New-Thing ');
  if r.full_name <> 'initech/new-thing' or not r.tracked or r.added_by <> '00000000-0000-4000-8000-0000000061a1'::uuid then
    raise exception 'FAIL: add_repository did not add initech/new-thing tracked, by its owner: %', r;
  end if;
  r := public.add_repository(pg_temp.ws('initech'), 'initech/new-thing');
  if (select count(*) from public.repositories where full_name = 'initech/new-thing') <> 1 then
    raise exception 'FAIL: adding a listed repository again made a second row';
  end if;

  begin
    perform public.add_repository(pg_temp.ws('initech'), 'not a repository');
    raise exception 'FAIL: add_repository took a name that is not owner/name';
  exception when invalid_parameter_value then null; end;

  r := public.set_repository_tracked(pg_temp.ws('initech'), 'initech/nimbus-apps', false);
  if r.tracked then raise exception 'FAIL: set_repository_tracked did not switch tracking off'; end if;
  if (select count(*) from public.pull_requests where repo = 'initech/nimbus-apps') <> 1 then
    raise exception 'FAIL: switching tracking off lost the repository''s pull requests';
  end if;
  r := public.set_repository_tracked(pg_temp.ws('initech'), 'initech/nimbus-apps', true);
  if not r.tracked then raise exception 'FAIL: set_repository_tracked did not switch tracking back on'; end if;

  begin
    perform public.set_repository_tracked(pg_temp.ws('initech'), 'initech/missing', false);
    raise exception 'FAIL: set_repository_tracked switched a repository that is not listed';
  exception when no_data_found then null; end;

  -- Olga owns Initech only.
  begin
    perform public.add_repository(pg_temp.ws('acme-repos'), 'acme-repos/widgets');
    raise exception 'FAIL: Initech''s owner added a repository to Acme';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── The service role writes the collection columns only ──
set local role service_role;
do $$
begin
  update public.repositories set collected_at = now(), collected_until = now(), collect_error = null
   where workspace_id = pg_temp.ws('initech') and full_name = 'initech/nimbus-apps';
  begin
    update public.repositories set tracked = false where workspace_id = pg_temp.ws('initech');
    raise exception 'FAIL: the service role switched tracking directly';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Removing a repository hides it and keeps its history (PRD 2188) ──
-- Olga opens the business (every repository joins its first product) and adds Mobile. Mobile links
-- nimbus-apps and nimbus-brain, which consumes it, and plans in nimbus-apps; in the first product,
-- nimbus-brain consumes it too. nimbus-apps has a public board, an idea, a pull request with its
-- review, and a knowledge pack.
create temporary table made (name text primary key, id uuid);
grant select, insert on made to authenticated;
create function pg_temp.made(name text) returns uuid language sql as $$
  select m.id from made m where m.name = made.name;
$$;
-- Runs a call that must be refused to its caller with `code`.
create function pg_temp.refused(stmt text, code text, why text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % ran: %', why, stmt;
exception when others then
  if sqlstate <> code then raise exception 'FAIL: % answered % (%), not %', why, sqlstate, sqlerrm, code; end if;
end;
$$;
-- The repository's rows that are history, as one value.
create function pg_temp.history(repo text) returns text language sql as $$
  select (select count(*) from public.ideas i where i.repo = history.repo) || ' ideas, '
      || (select count(*) from public.pull_requests p where p.repo = history.repo) || ' pull requests, '
      || (select count(*) from public.pull_request_reviews v where v.repo = history.repo) || ' reviews, '
      || (select count(*) from public.knowledge_packs k where k.repository = history.repo) || ' packs';
$$;
create temporary table removed (round int primary key, r public.repositories);
grant select, insert on removed to authenticated;

set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000061a1');
do $$
declare
  b public.businesses;
begin
  b := public.business_open(pg_temp.ws('initech'));
  insert into made values ('first', (select p.id from public.products p where p.business_id = b.id order by p.ordinal limit 1));
  insert into made values ('mobile', (public.product_add(pg_temp.ws('initech'), 'Mobile')).id);
  perform public.product_repository_link(pg_temp.made('mobile'), 'initech/nimbus-apps');
  perform public.product_repository_link(pg_temp.made('mobile'), 'initech/nimbus-brain', p_consumes => array['initech/nimbus-apps']);
  perform public.product_repository_link(pg_temp.made('first'), 'initech/nimbus-brain', p_consumes => array['initech/nimbus-apps']);
  perform public.product_plan_repository_set(pg_temp.made('mobile'), 'initech/nimbus-apps');
  perform public.set_repository_public_ideas(pg_temp.ws('initech'), 'initech/nimbus-apps', true);
end $$;
reset role;

insert into public.ideas (workspace_id, repo, title, pitch, added_by)
values (pg_temp.ws('initech'), 'initech/nimbus-apps', 'Offline quotes', 'Draft a quote on site with no signal.', '00000000-0000-4000-8000-0000000061b1');
insert into public.knowledge_packs (workspace_id, repository, sha, committed_at, newest)
values (pg_temp.ws('initech'), 'initech/nimbus-apps', repeat('a', 40), now() - interval '1 day', true);

do $$
begin
  if pg_temp.history('initech/nimbus-apps') <> '1 ideas, 1 pull requests, 1 reviews, 1 packs' then
    raise exception 'FAIL: nimbus-apps does not start with its history: %', pg_temp.history('initech/nimbus-apps');
  end if;
  if (select count(*) from public.product_repositories where repository = 'initech/nimbus-apps') <> 2
     or (select plan_repository from public.products where id = pg_temp.made('mobile')) is distinct from 'initech/nimbus-apps' then
    raise exception 'FAIL: nimbus-apps does not start in both products, Mobile planning in it';
  end if;
end $$;

-- A member is refused, an unknown repository answers P0002, and nothing changes.
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000061b1');
select pg_temp.refused(format('select public.remove_repository(%L, ''initech/nimbus-apps'')', pg_temp.ws('initech')), '42501', 'a member removing a repository');
select pg_temp.sign_in('00000000-0000-4000-8000-0000000061a1');
select pg_temp.refused(format('select public.remove_repository(%L, ''initech/missing'')', pg_temp.ws('initech')), 'P0002', 'removing a repository the workspace does not list');
reset role;

do $$
begin
  if (select removed_at from public.repositories where full_name = 'initech/nimbus-apps') is not null
     or (select count(*) from public.product_repositories where repository = 'initech/nimbus-apps') <> 2 then
    raise exception 'FAIL: a refused remove changed nimbus-apps';
  end if;
end $$;

-- The owner removes it, in any case, then removes it again.
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000061a1');
do $$
begin
  insert into removed values (1, public.remove_repository(pg_temp.ws('initech'), '  Initech/Nimbus-Apps '));
  insert into removed values (2, public.remove_repository(pg_temp.ws('initech'), 'initech/nimbus-apps'));
end $$;
reset role;

do $$
declare
  r public.repositories := (select x.r from removed x where x.round = 1);
begin
  if r.full_name <> 'initech/nimbus-apps' or r.removed_at is null or r.tracked or r.public_ideas then
    raise exception 'FAIL: remove_repository did not answer nimbus-apps removed, untracked and private: %', r;
  end if;
  if (select x.r from removed x where x.round = 2)::text <> r::text then
    raise exception 'FAIL: removing twice did not answer the same row: %', (select x.r from removed x where x.round = 2);
  end if;
  if (select row(x.*)::text from public.repositories x where x.full_name = 'initech/nimbus-apps') <> r::text then
    raise exception 'FAIL: the stored row is not the one remove_repository answered';
  end if;
  if exists (select 1 from public.product_repositories where repository = 'initech/nimbus-apps') then
    raise exception 'FAIL: a product still links the removed repository';
  end if;
  if exists (select 1 from public.product_repositories where 'initech/nimbus-apps' = any (consumes)) then
    raise exception 'FAIL: a link still consumes the removed repository';
  end if;
  if (select count(*) from public.product_repositories where repository = 'initech/nimbus-brain') <> 2 then
    raise exception 'FAIL: removing nimbus-apps took nimbus-brain out of a product';
  end if;
  if (select plan_repository from public.products where id = pg_temp.made('mobile')) is not null then
    raise exception 'FAIL: Mobile still plans in the removed repository';
  end if;
  if pg_temp.history('initech/nimbus-apps') <> '1 ideas, 1 pull requests, 1 reviews, 1 packs' then
    raise exception 'FAIL: removing lost the repository''s history: %', pg_temp.history('initech/nimbus-apps');
  end if;
  if (select count(*) from public.repositories where removed_at is not null) <> 1 then
    raise exception 'FAIL: removing one repository removed another';
  end if;
end $$;

-- A removed repository cannot be linked to a product or set as its plan repository; adding it again lists
-- it, tracked, with its history, and no link or plan repository comes back.
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000061a1');
select pg_temp.refused(format('select public.product_repository_link(%L, ''initech/nimbus-apps'')', pg_temp.made('mobile')), 'P0002', 'linking a removed repository');
select pg_temp.refused(format('select public.product_plan_repository_set(%L, ''initech/nimbus-apps'')', pg_temp.made('mobile')), 'P0002', 'planning in a removed repository');
do $$
declare
  r public.repositories;
begin
  r := public.add_repository(pg_temp.ws('initech'), 'initech/nimbus-apps');
  if r.removed_at is not null or not r.tracked then
    raise exception 'FAIL: adding a removed repository again did not list it, tracked: %', r;
  end if;
end $$;
reset role;

do $$
begin
  if pg_temp.history('initech/nimbus-apps') <> '1 ideas, 1 pull requests, 1 reviews, 1 packs' then
    raise exception 'FAIL: adding back lost the repository''s history: %', pg_temp.history('initech/nimbus-apps');
  end if;
  if exists (select 1 from public.product_repositories where repository = 'initech/nimbus-apps')
     or (select plan_repository from public.products where id = pg_temp.made('mobile')) is not null then
    raise exception 'FAIL: adding back brought a product link or a plan repository back';
  end if;
  if (select count(*) from public.repositories where full_name = 'initech/nimbus-apps') <> 1 then
    raise exception 'FAIL: adding back made a second row';
  end if;
end $$;

set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000061a1');
do $$
begin
  perform public.product_repository_link(pg_temp.made('mobile'), 'initech/nimbus-apps');
  perform public.product_plan_repository_set(pg_temp.made('mobile'), 'initech/nimbus-apps');
end $$;
reset role;

rollback;

\echo 'repositories: every check passed'
