-- A repository in several products, each link with its own fields (PRD 1364 s1). The supabase workflow
-- runs it on every pull request, after `supabase db start` has applied the migrations and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/product_repositories.sql
-- One repository is linked to two products, each link with its own role, knowledge, read-at, read-only
-- and consumes, and both products list it. A self-consume, a consumes naming a repository outside the
-- product, and an imported link with no read-at are refused, naming the field. A workspace's owner, and
-- only its owner, links and unlinks through product_repository_link() and product_repository_unlink():
-- a member, the owner of another workspace and anyone signed out are refused (42501), and nobody writes
-- the table directly. Every member reads the workspace's links; a stranger reads none. A new repository
-- is in no product. repository_set_product() still works, as a link, until landing 3 drops it, and
-- every repository that points at a product has a link to it. One transaction, rolled back at the end.
-- Any `FAIL:` stops the run.

begin;

-- ── After the migration: the default trigger is gone, and every product a repository points at is a link ──
do $$
begin
  if exists (select 1 from pg_trigger where tgname = 'repositories_default_product') then
    raise exception 'FAIL: the trigger that puts a new repository into the first product is still there';
  end if;
  if exists (select 1 from public.repositories r
              where r.product_id is not null
                and not exists (select 1 from public.product_repositories l
                                 where l.product_id = r.product_id and l.repository = r.full_name and l.added_by = 'person')) then
    raise exception 'FAIL: a repository points at a product it has no link to';
  end if;
end $$;

-- ── The cast ──
-- Olga owns Vertuoza and Mo is a member of it; Carl owns Acme; Sam belongs to no workspace.
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000001364a1', 'olga@prodrepo.test', now()),
  ('00000000-0000-4000-8000-0000001364b1', 'mo@prodrepo.test', now()),
  ('00000000-0000-4000-8000-0000001364c1', 'carl@prodrepo.test', now()),
  ('00000000-0000-4000-8000-0000001364d1', 'sam@prodrepo.test', now());
insert into public.workspaces (slug, name, github_org) values ('acme-prodrepo', 'Acme', 'acme-prodrepo');
insert into public.workspace_members (workspace_id, user_id, role)
select w.id, m.user_id, m.role
  from (values
         ('vertuoza',      '00000000-0000-4000-8000-0000001364a1'::uuid, 'owner'),
         ('vertuoza',      '00000000-0000-4000-8000-0000001364b1'::uuid, 'member'),
         ('acme-prodrepo', '00000000-0000-4000-8000-0000001364c1'::uuid, 'owner')
       ) as m (slug, user_id, role)
  join public.workspaces w on w.slug = m.slug;

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create temporary table ids (slug text primary key, id uuid);
insert into ids select w.slug, w.id from public.workspaces w where w.slug in ('vertuoza', 'acme-prodrepo');
grant select on ids to anon, authenticated, service_role;
create function pg_temp.ws(slug text) returns uuid language sql as $$
  select i.id from ids i where i.slug = ws.slug;
$$;
-- The ids the owner makes, saved by name.
create temporary table made (name text primary key, id uuid);
grant select, insert on made to anon, authenticated, service_role;
create function pg_temp.made(name text) returns uuid language sql as $$
  select m.id from made m where m.name = made.name;
$$;
-- The workspace's links, as one value to compare before and after a refusal.
create function pg_temp.links() returns text language sql as $$
  select coalesce(string_agg(row(l.*)::text, ';' order by l.product_id, l.repository), '') from public.product_repositories l;
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

-- ── Olga opens the business and adds Mobile and Estimates ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000001364a1');
do $$
declare
  b public.businesses;
begin
  b := public.business_open(pg_temp.ws('vertuoza'));
  insert into made values ('first', (select p.id from public.products p where p.business_id = b.id order by p.ordinal limit 1));
  insert into made values ('mobile', (public.product_add(pg_temp.ws('vertuoza'), 'Mobile')).id);
  insert into made values ('estimates', (public.product_add(pg_temp.ws('vertuoza'), 'Estimates')).id);
  -- business_open points each repository at the first product: each one is a link to it.
  if (select count(*) from public.product_repositories l where l.product_id = pg_temp.made('first') and l.added_by = 'person')
     <> (select count(*) from public.repositories r where r.workspace_id = pg_temp.ws('vertuoza')) then
    raise exception 'FAIL: the repositories business_open points at the first product are not linked to it';
  end if;
end $$;
reset role;

create temporary table links_before (links text);
insert into links_before select pg_temp.links();

-- The calls and writes every outsider tries.
create temporary table calls (stmt text);
insert into calls
select format(c, pg_temp.made('mobile'))
  from unnest(array[
    'select public.product_repository_link(%L, ''vertuoza/vertuo-apps'', ''web'')',
    'select public.product_repository_unlink(%L, ''vertuoza/pdf-builder'')'
  ]) c;
grant select on calls to anon, authenticated;
create temporary table writes (stmt text);
insert into writes
select format(c, pg_temp.made('mobile'), pg_temp.ws('vertuoza'))
  from unnest(array[
    'insert into public.product_repositories (product_id, workspace_id, repository) values (%L, %L, ''vertuoza/vertuo-apps'')',
    'update public.product_repositories set role = ''x'' where product_id = %L or workspace_id = %L',
    'delete from public.product_repositories where product_id = %L or workspace_id = %L'
  ]) c;
grant select on writes to anon, authenticated;

-- ── Signed out: every call and write refused, nothing read ──
set local role anon;
do $$
declare c text;
begin
  for c in select stmt from calls loop perform pg_temp.refused(c, '42501', 'anon'); end loop;
  for c in select stmt from writes loop perform pg_temp.refused(c, '42501', 'anon'); end loop;
  perform pg_temp.refused('select 1 from public.product_repositories', '42501', 'anon reading the links');
end $$;
reset role;

-- ── A member of Vertuoza: reads the links, writes none ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000001364b1');
do $$
declare c text;
begin
  if (select count(*) from public.product_repositories) <> 6 then
    raise exception 'FAIL: a member does not read their workspace''s six links';
  end if;
  for c in select stmt from calls loop perform pg_temp.refused(c, '42501', 'a member'); end loop;
  for c in select stmt from writes loop perform pg_temp.refused(c, '42501', 'a member, directly'); end loop;
end $$;

-- ── Acme's owner and a stranger: refused, read nothing ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000001364c1');
do $$
declare c text;
begin
  for c in select stmt from calls loop perform pg_temp.refused(c, '42501', 'the owner of another workspace'); end loop;
  if exists (select 1 from public.product_repositories) then
    raise exception 'FAIL: the owner of another workspace reads Vertuoza''s links';
  end if;
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000001364d1');
do $$
declare c text;
begin
  for c in select stmt from calls loop perform pg_temp.refused(c, '42501', 'a stranger'); end loop;
  if exists (select 1 from public.product_repositories) then
    raise exception 'FAIL: a stranger reads links';
  end if;
end $$;
reset role;

do $$
begin
  if pg_temp.links() <> (select links from links_before) then
    raise exception 'FAIL: a refused call changed the links';
  end if;
  if has_table_privilege('authenticated', 'public.product_repositories', 'insert')
     or has_table_privilege('authenticated', 'public.product_repositories', 'update')
     or has_table_privilege('authenticated', 'public.product_repositories', 'delete') then
    raise exception 'FAIL: authenticated holds a write grant on product_repositories';
  end if;
end $$;

-- ── The owner: one repository in two products, each link its own ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000001364a1');
do $$
declare
  c text;
  l public.product_repositories;
  sha constant text := '0123456789abcdef0123456789abcdef01234567';
begin
  for c in select stmt from writes loop perform pg_temp.refused(c, '42501', 'the owner, directly'); end loop;

  l := public.product_repository_link(pg_temp.made('mobile'), 'vertuoza/vertuo-apps', 'mobile');
  if l.role <> 'mobile' or l.knowledge <> 'own' or l.read_at is not null or l.read_only or l.consumes <> '{}'
     or l.added_by <> 'person' or l.workspace_id <> pg_temp.ws('vertuoza') then
    raise exception 'FAIL: a link takes its defaults: %', l;
  end if;
  l := public.product_repository_link(pg_temp.made('mobile'), '  Vertuoza/Vertuo-Backend-PHP ', 'api', 'imported', sha, false,
                                      array['vertuoza/vertuo-apps']);
  if l.repository <> 'vertuoza/vertuo-backend-php' then
    raise exception 'FAIL: a link''s repository is not owner/name in lower case: %', l.repository;
  end if;
  l := public.product_repository_link(pg_temp.made('estimates'), 'vertuoza/vertuo-backend-php', 'backend', 'none', null, true);

  if (select string_agg(p.name || ':' || x.role || ':' || x.knowledge || ':' || coalesce(x.read_at, '-') || ':' || x.read_only
                        || ':' || array_to_string(x.consumes, ','), ' ' order by p.name)
        from public.product_repositories x join public.products p on p.id = x.product_id
       where x.repository = 'vertuoza/vertuo-backend-php' and p.id in (pg_temp.made('mobile'), pg_temp.made('estimates')))
     is distinct from 'Estimates:backend:none:-:true: Mobile:api:imported:' || sha || ':false:vertuoza/vertuo-apps' then
    raise exception 'FAIL: vertuoza/vertuo-backend-php is not in Mobile and Estimates, each link its own';
  end if;

  -- Editing a link keeps who added it.
  l := public.product_repository_link(pg_temp.made('mobile'), 'vertuoza/vertuo-apps', 'web');
  if l.role <> 'web' or l.added_by <> 'person'
     or (select count(*) from public.product_repositories x where x.product_id = pg_temp.made('mobile') and x.repository = 'vertuoza/vertuo-apps') <> 1 then
    raise exception 'FAIL: linking a linked repository again did not edit its link: %', l;
  end if;

  -- The refusals, each naming its field.
  perform pg_temp.refused(format('select public.product_repository_link(%L, ''vertuoza/vertuo-apps'', ''web'', ''own'', null, false, array[''vertuoza/vertuo-apps''])', pg_temp.made('mobile')),
                          '22023', 'a self-consume');
  perform pg_temp.refused(format('select public.product_repository_link(%L, ''vertuoza/vertuo-apps'', ''web'', ''own'', null, false, array[''vertuoza/pdf-builder-x''])', pg_temp.made('mobile')),
                          '22023', 'a consumes outside the product');
  -- pdf-builder is in the first product only, not Mobile.
  perform pg_temp.refused(format('select public.product_repository_link(%L, ''vertuoza/vertuo-apps'', ''web'', ''own'', null, false, array[''vertuoza/pdf-builder''])', pg_temp.made('mobile')),
                          '22023', 'a consumes naming a repository of another product');
  perform pg_temp.refused(format('select public.product_repository_link(%L, ''vertuoza/vertuo-apps'', ''web'', ''imported'')', pg_temp.made('mobile')),
                          '22023', 'an imported link with no read-at');
  perform pg_temp.refused(format('select public.product_repository_link(%L, ''vertuoza/vertuo-apps'', ''web'', ''own'', %L)', pg_temp.made('mobile'), sha),
                          '22023', 'a read-at on a link that is not imported');
  perform pg_temp.refused(format('select public.product_repository_link(%L, ''vertuoza/vertuo-apps'', ''web'', ''imported'', ''abc'')', pg_temp.made('mobile')),
                          '22023', 'a read-at that is not a commit');
  perform pg_temp.refused(format('select public.product_repository_link(%L, ''vertuoza/vertuo-apps'', ''Web App'')', pg_temp.made('mobile')),
                          '22023', 'a role that is not one kebab-case word');
  perform pg_temp.refused(format('select public.product_repository_link(%L, ''vertuoza/vertuo-apps'', ''web'', ''some'')', pg_temp.made('mobile')),
                          '22023', 'a knowledge that is not own, imported or none');
  perform pg_temp.refused(format('select public.product_repository_link(%L, ''vertuoza/missing'', ''web'')', pg_temp.made('mobile')),
                          'P0002', 'a repository the workspace does not list');
  perform pg_temp.refused('select public.product_repository_link(''00000000-0000-4000-8000-000000000000'', ''vertuoza/vertuo-apps'', ''web'')',
                          'P0002', 'a product that does not exist');
  begin
    perform public.product_repository_link(pg_temp.made('mobile'), 'vertuoza/vertuo-apps', 'web', 'own', null, false, array['vertuoza/vertuo-apps']);
  exception when invalid_parameter_value then
    if sqlerrm not like 'Consumes:%' then raise exception 'FAIL: a self-consume''s refusal does not name its field: %', sqlerrm; end if;
  end;
  begin
    perform public.product_repository_link(pg_temp.made('mobile'), 'vertuoza/vertuo-apps', 'web', 'imported');
  exception when invalid_parameter_value then
    if sqlerrm not like 'Read at:%' then raise exception 'FAIL: a missing read-at''s refusal does not name its field: %', sqlerrm; end if;
  end;

  -- Unlinking: refused while another link of the product consumes it, then true, then false.
  perform pg_temp.refused(format('select public.product_repository_unlink(%L, ''vertuoza/vertuo-apps'')', pg_temp.made('mobile')),
                          '22023', 'unlinking a repository another link consumes');
  perform public.product_repository_link(pg_temp.made('mobile'), 'vertuoza/vertuo-backend-php', 'api', 'imported', sha);
  if not public.product_repository_unlink(pg_temp.made('mobile'), 'vertuoza/vertuo-apps') then
    raise exception 'FAIL: unlinking a linked repository answered false';
  end if;
  if public.product_repository_unlink(pg_temp.made('mobile'), 'vertuoza/vertuo-apps') then
    raise exception 'FAIL: unlinking an unlinked repository answered true';
  end if;
  if exists (select 1 from public.product_repositories x where x.product_id = pg_temp.made('mobile') and x.repository = 'vertuoza/vertuo-apps') then
    raise exception 'FAIL: unlinking kept the link';
  end if;

  -- A product links only the repositories of its own workspace.
  perform pg_temp.refused('select public.product_repository_link(' || quote_literal(pg_temp.made('mobile')) || ', ''acme-prodrepo/widgets'', ''web'')',
                          'P0002', 'a repository of another workspace');
end $$;

-- ── A new repository is in no product ──
do $$
declare r public.repositories;
begin
  r := public.add_repository(pg_temp.ws('vertuoza'), 'vertuoza/brand-new');
  if r.product_id is not null or exists (select 1 from public.product_repositories l where l.repository = 'vertuoza/brand-new') then
    raise exception 'FAIL: a new repository is in a product: %', r;
  end if;
end $$;
reset role;

-- ── repository_set_product(), until landing 3: a member moves a repository, and its link moves with it ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000001364b1');
do $$
declare r public.repositories;
begin
  r := public.repository_set_product(pg_temp.ws('vertuoza'), 'vertuoza/pdf-builder', pg_temp.made('mobile'));
  if r.product_id <> pg_temp.made('mobile') then raise exception 'FAIL: repository_set_product did not point it: %', r; end if;
  if not exists (select 1 from public.product_repositories l
                  where l.product_id = pg_temp.made('mobile') and l.repository = 'vertuoza/pdf-builder' and l.added_by = 'person')
     or exists (select 1 from public.product_repositories l
                 where l.product_id = pg_temp.made('first') and l.repository = 'vertuoza/pdf-builder') then
    raise exception 'FAIL: repository_set_product did not move the link from the first product to Mobile';
  end if;
  -- Its other links stay.
  r := public.repository_set_product(pg_temp.ws('vertuoza'), 'vertuoza/vertuo-backend-php', pg_temp.made('mobile'));
  if (select string_agg(p.name, ',' order by p.name) from public.product_repositories l join public.products p on p.id = l.product_id
       where l.repository = 'vertuoza/vertuo-backend-php') is distinct from 'Estimates,Mobile' then
    raise exception 'FAIL: repository_set_product touched a link of another product';
  end if;
  if (select l.role from public.product_repositories l where l.product_id = pg_temp.made('mobile') and l.repository = 'vertuoza/vertuo-backend-php')
     is distinct from 'api' then
    raise exception 'FAIL: repository_set_product rewrote the fields of a link that was there';
  end if;
end $$;
reset role;

-- ── Every repository that points at a product, still: a link to it ──
do $$
begin
  if exists (select 1 from public.repositories r
              where r.product_id is not null
                and not exists (select 1 from public.product_repositories l where l.product_id = r.product_id and l.repository = r.full_name)) then
    raise exception 'FAIL: a repository points at a product it has no link to';
  end if;
end $$;

rollback;

\echo 'product_repositories: every check passed'
