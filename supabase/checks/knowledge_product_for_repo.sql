-- The product a terminal's knowledge change lands on (PRD 2268 s1). The supabase workflow runs it on every
-- pull request, after `supabase db start` has applied the migrations and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/knowledge_product_for_repo.sql
-- knowledge_product_for_repo(repo, product), as the caller: the caller's workspace for the repository
-- (business_workspace()), then the product named (by its name or its key, without case) among the
-- repository's products, else the repository's only product. A repository in several products and no
-- product named is refused naming them (21000); in none, or naming a product it is not in, P0002; a
-- product archived, P0002 saying so; another workspace's repository, or nobody signed in, 42501. It
-- answers {id, workspace, name} and writes nothing. One transaction, rolled back at the end. Any `FAIL:`
-- stops the run.

begin;

-- ── The cast ──
-- Olga owns KP, Mo is a member; Zed is in Other alone. KP sells Mobile (key mobile), Estimates and Legacy,
-- archived. kp-org/api is in Mobile and Estimates, kp-org/solo in Mobile alone, kp-org/lone in none,
-- kp-org/old in Legacy alone, and kp-org/mixed in Legacy and Estimates. other-org/api is in Other's Field.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000022680a1', 'olga@kp.test'),
  ('00000000-0000-4000-8000-0000022680b1', 'mo@kp.test'),
  ('00000000-0000-4000-8000-0000022680c1', 'zed@other.test');
insert into public.workspaces (id, slug, name, github_org) values
  ('00000000-0000-4000-8000-000002268000', 'kp', 'KP', 'kp-org'),
  ('00000000-0000-4000-8000-000002268001', 'other', 'Other', 'other-org');
insert into public.workspace_members (workspace_id, user_id, role) values
  ('00000000-0000-4000-8000-000002268000', '00000000-0000-4000-8000-0000022680a1', 'owner'),
  ('00000000-0000-4000-8000-000002268000', '00000000-0000-4000-8000-0000022680b1', 'member'),
  ('00000000-0000-4000-8000-000002268001', '00000000-0000-4000-8000-0000022680c1', 'owner');
insert into public.businesses (id, workspace_id, name) values
  ('00000000-0000-4000-8000-0000022680f0', '00000000-0000-4000-8000-000002268000', 'KP'),
  ('00000000-0000-4000-8000-0000022680f1', '00000000-0000-4000-8000-000002268001', 'Other');
insert into public.products (id, workspace_id, business_id, name, key, pitch_look, pitch, archived_at) values
  ('00000000-0000-4000-8000-0000022680e1', '00000000-0000-4000-8000-000002268000', '00000000-0000-4000-8000-0000022680f0', 'Mobile', 'mobile', 'arcade', '{}', null),
  ('00000000-0000-4000-8000-0000022680e2', '00000000-0000-4000-8000-000002268000', '00000000-0000-4000-8000-0000022680f0', 'Estimates', null, 'arcade', '{}', null),
  ('00000000-0000-4000-8000-0000022680e3', '00000000-0000-4000-8000-000002268000', '00000000-0000-4000-8000-0000022680f0', 'Legacy', null, 'arcade', '{}', now()),
  ('00000000-0000-4000-8000-0000022680e9', '00000000-0000-4000-8000-000002268001', '00000000-0000-4000-8000-0000022680f1', 'Field', null, 'arcade', '{}', null);
insert into public.repositories (workspace_id, full_name) values
  ('00000000-0000-4000-8000-000002268000', 'kp-org/api'),
  ('00000000-0000-4000-8000-000002268000', 'kp-org/solo'),
  ('00000000-0000-4000-8000-000002268000', 'kp-org/lone'),
  ('00000000-0000-4000-8000-000002268000', 'kp-org/old'),
  ('00000000-0000-4000-8000-000002268000', 'kp-org/mixed'),
  ('00000000-0000-4000-8000-000002268001', 'other-org/api');
insert into public.product_repositories (product_id, workspace_id, repository, role, added_by) values
  ('00000000-0000-4000-8000-0000022680e1', '00000000-0000-4000-8000-000002268000', 'kp-org/api', 'api', 'person'),
  ('00000000-0000-4000-8000-0000022680e2', '00000000-0000-4000-8000-000002268000', 'kp-org/api', 'api', 'person'),
  ('00000000-0000-4000-8000-0000022680e1', '00000000-0000-4000-8000-000002268000', 'kp-org/solo', 'mobile', 'person'),
  ('00000000-0000-4000-8000-0000022680e3', '00000000-0000-4000-8000-000002268000', 'kp-org/old', 'api', 'person'),
  ('00000000-0000-4000-8000-0000022680e3', '00000000-0000-4000-8000-000002268000', 'kp-org/mixed', 'api', 'person'),
  ('00000000-0000-4000-8000-0000022680e2', '00000000-0000-4000-8000-000002268000', 'kp-org/mixed', 'api', 'person'),
  ('00000000-0000-4000-8000-0000022680e9', '00000000-0000-4000-8000-000002268001', 'other-org/api', 'api', 'person');

create function pg_temp.sign_in(uid text, email text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'email', email, 'role', 'authenticated')::text, true);
$$;
-- What a lookup found, on one line: the product's name, and whether it is the workspace given.
create function pg_temp.found(got jsonb, ws text) returns text language sql as $$
  select (got ->> 'name') || case when got ->> 'workspace' = ws then '' else ' in another workspace' end
      || case when (got ->> 'id') = (select p.id::text from public.products p where p.name = got ->> 'name') then '' else ' with another id' end;
$$;
-- Runs a call that must be refused with `code`, its message holding `words`.
create function pg_temp.refused(stmt text, code text, words text, why text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % ran: %', why, stmt;
exception when others then
  if sqlerrm like 'FAIL:%' then raise; end if;
  if sqlstate <> code then raise exception 'FAIL: % answered % (%), not %', why, sqlstate, sqlerrm, code; end if;
  if position(words in sqlerrm) = 0 then raise exception 'FAIL: % said "%", not "%"', why, sqlerrm, words; end if;
end;
$$;
grant execute on function pg_temp.refused(text, text, text, text) to anon, authenticated;
grant execute on function pg_temp.found(jsonb, text) to authenticated;

set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000022680b1', 'mo@kp.test');

-- ── One product: the repository's only one, for any member ──
do $$
declare
  got text;
begin
  got := pg_temp.found(public.knowledge_product_for_repo('kp-org/solo'), '00000000-0000-4000-8000-000002268000');
  if got <> 'Mobile' then raise exception 'FAIL: a repository of one product, named by nobody: %', got; end if;
  got := pg_temp.found(public.knowledge_product_for_repo(' KP-Org/Solo ', null), '00000000-0000-4000-8000-000002268000');
  if got <> 'Mobile' then raise exception 'FAIL: the repository is read without case or spaces: %', got; end if;
  got := pg_temp.found(public.knowledge_product_for_repo('kp-org/solo', '  '), '00000000-0000-4000-8000-000002268000');
  if got <> 'Mobile' then raise exception 'FAIL: a blank product names none: %', got; end if;
  got := pg_temp.found(public.knowledge_product_for_repo('kp-org/solo', 'MOBILE'), '00000000-0000-4000-8000-000002268000');
  if got <> 'Mobile' then raise exception 'FAIL: the product named, without case: %', got; end if;
end $$;

-- ── Several products: named, by name or key, else refused naming them ──
do $$
declare
  got text;
begin
  got := pg_temp.found(public.knowledge_product_for_repo('kp-org/api', 'estimates'), '00000000-0000-4000-8000-000002268000');
  if got <> 'Estimates' then raise exception 'FAIL: a repository of two products, Estimates named: %', got; end if;
  got := pg_temp.found(public.knowledge_product_for_repo('kp-org/api', 'mobile'), '00000000-0000-4000-8000-000002268000');
  if got <> 'Mobile' then raise exception 'FAIL: a repository of two products, Mobile named by its key: %', got; end if;
  -- An archived product among them is not counted: kp-org/mixed reads as Estimates' alone.
  got := pg_temp.found(public.knowledge_product_for_repo('kp-org/mixed'), '00000000-0000-4000-8000-000002268000');
  if got <> 'Estimates' then raise exception 'FAIL: an archived product is not one of a repository''s products: %', got; end if;
end $$;
select pg_temp.refused($$select public.knowledge_product_for_repo('kp-org/api')$$, '21000',
  'kp-org/api is in 2 products: Mobile, Estimates; pass --product', 'a repository of two products, none named');
select pg_temp.refused($$select public.knowledge_product_for_repo('kp-org/api', 'Field')$$, 'P0002',
  'Product: Field is not one of kp-org/api''s products (Mobile, Estimates).', 'a product the repository is not in');

-- ── No product ──
select pg_temp.refused($$select public.knowledge_product_for_repo('kp-org/lone')$$, 'P0002',
  'kp-org/lone is in no product yet: link it on a product''s page.', 'a repository in no product');
select pg_temp.refused($$select public.knowledge_product_for_repo('kp-org/lone', 'Mobile')$$, 'P0002',
  'Product: Mobile is not one of kp-org/lone''s products (none).', 'a product named for a repository in none');

-- ── An archived product ──
select pg_temp.refused($$select public.knowledge_product_for_repo('kp-org/old')$$, 'P0002',
  'Product Legacy is archived: an owner restores it on its page.', 'a repository whose only product is archived');
select pg_temp.refused($$select public.knowledge_product_for_repo('kp-org/old', 'legacy')$$, 'P0002',
  'Product Legacy is archived: an owner restores it on its page.', 'an archived product named');
select pg_temp.refused($$select public.knowledge_product_for_repo('kp-org/mixed', 'Legacy')$$, 'P0002',
  'Product Legacy is archived: an owner restores it on its page.', 'an archived product named among live ones');

-- ── Another workspace's repository (law BR-PRODUCT-63), and a malformed one ──
select pg_temp.refused($$select public.knowledge_product_for_repo('other-org/api')$$, '42501',
  'you are not a member of Other, which owns other-org/api', 'another workspace''s repository');
select pg_temp.refused($$select public.knowledge_product_for_repo('other-org/api', 'Field')$$, '42501',
  'you are not a member of Other', 'another workspace''s product, named');
select pg_temp.refused($$select public.knowledge_product_for_repo('not a repo')$$, '22023', 'Repository: owner/name.', 'a malformed repository');

-- ── Nobody signed in ──
select set_config('request.jwt.claims', '', true);
select pg_temp.refused($$select public.knowledge_product_for_repo('kp-org/solo')$$, '42501', 'Sign in first.', 'nobody signed in');
reset role;
set local role anon;
select pg_temp.refused($$select public.knowledge_product_for_repo('kp-org/solo')$$, '42501', 'permission denied', 'the anon role');
reset role;

-- ── It writes nothing, and is stable ──
do $$
begin
  if (select p.provolatile from pg_proc p where p.oid = 'public.knowledge_product_for_repo(text, text)'::regprocedure) <> 's' then
    raise exception 'FAIL: knowledge_product_for_repo() is not stable';
  end if;
  if not (select p.prosecdef from pg_proc p where p.oid = 'public.knowledge_product_for_repo(text, text)'::regprocedure) then
    raise exception 'FAIL: knowledge_product_for_repo() does not run as its definer';
  end if;
end $$;

rollback;
