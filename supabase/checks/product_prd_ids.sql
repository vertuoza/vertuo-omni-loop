-- A product PRD's id, `<key>-<n>` (PRD 1548 s1). The supabase workflow runs it on every pull request,
-- after `supabase db start` has applied the migrations and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/product_prd_ids.sql
-- Only an owner sets a product's key, once, in lowercase kebab-case, unique in the workspace; a key out
-- of shape, taken, or changed is refused. dossier_push() with a product key creates the product's next
-- PRD, a dossier with no home repository, numbered from its birth and born on the server, and pushes to
-- one by its number; neither its number nor its product changes after, and its opener cannot delete it.
-- A dossier is keyed by exactly one of its repository and its product's counter. dossier_approval(),
-- approval_request() and dossier_approve() find and approve a product PRD by its key, as the approval
-- stream reads it, and a PRD of a repository is found by its number as before, never as a product PRD.
-- Another workspace's key is its own. The rollback guard refuses while a product PRD exists. One
-- transaction, rolled back at the end; then two creates at once, in two sessions on rows they commit and
-- delete, take two numbers with no gap. Any `FAIL:` stops the run.

begin;

-- ── The columns ──
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'products' and column_name = 'key' and is_nullable = 'YES') then
    raise exception 'FAIL: products.key is missing, or required';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'dossiers' and column_name = 'product_seq' and is_nullable = 'YES') then
    raise exception 'FAIL: dossiers.product_seq is missing, or required';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'dossiers' and column_name = 'home_repo' and is_nullable = 'YES') then
    raise exception 'FAIL: dossiers.home_repo is still required';
  end if;
  if not has_column_privilege('authenticated', 'public.dossiers', 'product_seq', 'select')
     or not has_column_privilege('authenticated', 'public.products', 'key', 'select') then
    raise exception 'FAIL: a member cannot read a product PRD''s number or its product''s key';
  end if;
  if has_column_privilege('authenticated', 'public.dossiers', 'product_seq', 'update')
     or has_column_privilege('authenticated', 'public.dossiers', 'product_seq', 'insert')
     or has_column_privilege('authenticated', 'public.products', 'key', 'update')
     or has_column_privilege('authenticated', 'public.products', 'prd_count', 'update') then
    raise exception 'FAIL: a key or a number is written other than through product_set_key() and dossier_push()';
  end if;
end $$;

-- ── The cast ──
-- Olga owns PK, Mo is a member of it; Carl owns PK Other; Sam belongs to no workspace. PK has Mobile and
-- Web, PK Other a product of its own it keys mobile too. pk-org/app is PK's repository.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000015481a1', 'olga@pk.test'),
  ('00000000-0000-4000-8000-0000015481b1', 'mo@pk.test'),
  ('00000000-0000-4000-8000-0000015481c1', 'carl@pk-other.test'),
  ('00000000-0000-4000-8000-0000015481d1', 'sam@pk.test');
insert into public.workspaces (id, slug, name, github_org) values
  ('00000000-0000-4000-8000-000001548100', 'pk', 'PK', 'pk-org'),
  ('00000000-0000-4000-8000-000001548101', 'pk-other', 'PK Other', 'pk-other');
insert into public.workspace_members (workspace_id, user_id, role) values
  ('00000000-0000-4000-8000-000001548100', '00000000-0000-4000-8000-0000015481a1', 'owner'),
  ('00000000-0000-4000-8000-000001548100', '00000000-0000-4000-8000-0000015481b1', 'member'),
  ('00000000-0000-4000-8000-000001548101', '00000000-0000-4000-8000-0000015481c1', 'owner');
insert into public.businesses (id, workspace_id, name) values
  ('00000000-0000-4000-8000-0000015481f0', '00000000-0000-4000-8000-000001548100', 'PK'),
  ('00000000-0000-4000-8000-0000015481f1', '00000000-0000-4000-8000-000001548101', 'PK Other');
insert into public.products (id, workspace_id, business_id, name) values
  ('00000000-0000-4000-8000-0000015481e1', '00000000-0000-4000-8000-000001548100', '00000000-0000-4000-8000-0000015481f0', 'Mobile'),
  ('00000000-0000-4000-8000-0000015481e2', '00000000-0000-4000-8000-000001548100', '00000000-0000-4000-8000-0000015481f0', 'Web'),
  ('00000000-0000-4000-8000-0000015481e9', '00000000-0000-4000-8000-000001548101', '00000000-0000-4000-8000-0000015481f1', 'Other');
insert into public.repositories (workspace_id, full_name) values
  ('00000000-0000-4000-8000-000001548100', 'pk-org/app');

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
-- Creates the product's next PRD (prd null) or pushes to PRD `prd` of the product keyed `key`.
create function pg_temp.push(key text, prd integer, kinds jsonb default '{}'::jsonb, repo text default null) returns jsonb language sql as $$
  select public.dossier_push(repo, prd, 'Offline photos', null,
    coalesce((select jsonb_agg(jsonb_build_object('kind', k.key, 'content', k.value #>> '{}')) from jsonb_each(kinds) k), '[]'::jsonb),
    'prd', null, key);
$$;
-- Runs a call that must be refused with `code`, its message holding `says` when given.
create function pg_temp.refused(stmt text, code text, why text, says text default null) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % ran: %', why, stmt;
exception when others then
  if sqlstate <> code then raise exception 'FAIL: % answered % (%), not %', why, sqlstate, sqlerrm, code; end if;
  if says is not null and sqlerrm <> says then raise exception 'FAIL: % said "%", not "%"', why, sqlerrm, says; end if;
end;
$$;
grant execute on function pg_temp.refused(text, text, text, text) to anon, authenticated;

create temporary table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;

-- ── Signed out: nothing ──
set local role anon;
select pg_temp.refused($$select public.product_set_key('00000000-0000-4000-8000-0000015481e1', 'mobile')$$, '42501', 'anon set a key');
select pg_temp.refused($$select public.dossier_push(null, null, 'x', null, '[]', 'prd', null, 'mobile')$$, '42501', 'anon pushed a product PRD');
reset role;

-- ── The key: an owner sets it once ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000015481b1');
select pg_temp.refused($$select public.product_set_key('00000000-0000-4000-8000-0000015481e1', 'mobile')$$, '42501', 'a member who owns nothing set a key');
select pg_temp.sign_in('00000000-0000-4000-8000-0000015481c1');
select pg_temp.refused($$select public.product_set_key('00000000-0000-4000-8000-0000015481e1', 'mobile')$$, '42501', 'another workspace''s owner set a key');
select pg_temp.refused($$select public.product_set_key(gen_random_uuid(), 'mobile')$$, 'P0002', 'a key was set on no product');
-- Carl keys his own product mobile: a key is unique in its workspace only.
do $$
begin
  if public.product_set_key('00000000-0000-4000-8000-0000015481e9', 'mobile') ->> 'key' <> 'mobile' then
    raise exception 'FAIL: another workspace could not key its product mobile';
  end if;
end $$;

select pg_temp.sign_in('00000000-0000-4000-8000-0000015481a1');
select pg_temp.refused($$select public.product_set_key('00000000-0000-4000-8000-0000015481e1', 'Mobile')$$, '22023', 'an upper-case key was set');
select pg_temp.refused($$select public.product_set_key('00000000-0000-4000-8000-0000015481e1', '12-mobile')$$, '22023', 'a key starting with a number was set');
select pg_temp.refused($$select public.product_set_key('00000000-0000-4000-8000-0000015481e1', 'mobile-12')$$, '22023', 'a key that reads as a PRD id was set');
select pg_temp.refused($$select public.product_set_key('00000000-0000-4000-8000-0000015481e1', 'mobile_app')$$, '22023', 'a snake_case key was set');
select pg_temp.refused($$select public.product_set_key('00000000-0000-4000-8000-0000015481e1', 'mobile-')$$, '22023', 'a key ending in a dash was set');
select pg_temp.refused($$select public.product_set_key('00000000-0000-4000-8000-0000015481e1', '')$$, '22023', 'an empty key was set');
select pg_temp.refused(format('select public.product_set_key(%L, %L)', '00000000-0000-4000-8000-0000015481e1', repeat('a', 41)), '22023', 'a key of 41 characters was set');
do $$
declare
  set_one jsonb;
begin
  set_one := public.product_set_key('00000000-0000-4000-8000-0000015481e1', 'mobile');
  if set_one <> jsonb_build_object('id', '00000000-0000-4000-8000-0000015481e1', 'name', 'Mobile', 'key', 'mobile') then
    raise exception 'FAIL: setting a key answered %', set_one;
  end if;
  if public.product_set_key('00000000-0000-4000-8000-0000015481e1', 'mobile') ->> 'key' <> 'mobile' then
    raise exception 'FAIL: setting the same key again was refused';
  end if;
  if public.product_set_key('00000000-0000-4000-8000-0000015481e2', 'web-app') ->> 'key' <> 'web-app' then
    raise exception 'FAIL: a kebab-case key was refused';
  end if;
end $$;
select pg_temp.refused($$select public.product_set_key('00000000-0000-4000-8000-0000015481e1', 'mob')$$, '22023', 'a key was changed');
select pg_temp.refused($$select public.product_set_key('00000000-0000-4000-8000-0000015481e2', 'web')$$, '22023', 'a second key was set');
reset role;
-- Not even the owner of the tables changes a key, or takes one twice in a workspace.
select pg_temp.refused($$update public.products set key = 'mob' where id = '00000000-0000-4000-8000-0000015481e1'$$, '22023', 'the table owner changed a key');
select pg_temp.refused($$update public.products set key = null where id = '00000000-0000-4000-8000-0000015481e1'$$, '22023', 'the table owner emptied a key');
select pg_temp.refused($$insert into public.products (workspace_id, business_id, name, key)
  values ('00000000-0000-4000-8000-000001548100', '00000000-0000-4000-8000-0000015481f0', 'Mobile 2', 'mobile')$$, '23505', 'two products of a workspace took one key');

-- ── A product PRD: created by its key, numbered on its product ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000015481b1');
select pg_temp.refused($$select pg_temp.push('nope', null)$$, 'P0002', 'a PRD was created on a key no product has');
select pg_temp.refused($$select pg_temp.push('Mobile', null)$$, '22023', 'a PRD was created on a key out of shape');
select pg_temp.refused($$select public.dossier_push(null, null, 'x', null, '[]', 'visual', null, 'mobile')$$, '22023', 'a product PRD of another kind was created');
select pg_temp.refused($$select public.dossier_push(null, null, 'x', gen_random_uuid(), '[]', 'prd', null, 'mobile')$$, '22023', 'a product PRD was created from a draft');
select pg_temp.refused($$select public.dossier_push(null, null, 'x', null, '[]', 'prd', 'Mobile', 'mobile')$$, '22023', 'a product PRD named its product twice');
select pg_temp.refused($$select pg_temp.push('mobile', 0)$$, '22023', 'a product PRD numbered 0 was pushed to');
select pg_temp.refused($$select public.dossier_push(null, null, 'x', null, '[]')$$, '22023', 'a push with no repository and no key ran');
do $$
declare
  one jsonb;
  two jsonb;
  row public.dossiers;
begin
  one := pg_temp.push('mobile', null, '{"spec": "---\nphase0: server\n---\n# Offline photos\n"}');
  if one ->> 'prdId' <> 'mobile-1' or one -> 'product' <> jsonb_build_object('id', '00000000-0000-4000-8000-0000015481e1', 'name', 'Mobile')
     or one -> 'added' <> '[{"kind": "spec", "version": 1}]'::jsonb then
    raise exception 'FAIL: the first product PRD answered %', one;
  end if;
  insert into ids values ('mobile-1', (one ->> 'id')::uuid);
  select d.* into row from public.dossiers d where d.id = (one ->> 'id')::uuid;
  if row.home_repo is not null or row.prd is not null or row.product_seq <> 1 or row.kind <> 'prd'
     or row.workspace_id <> '00000000-0000-4000-8000-000001548100' or row.numbered_at is null
     or row.birthplace is distinct from 'server' or row.opened_by <> '00000000-0000-4000-8000-0000015481b1' then
    raise exception 'FAIL: the first product PRD reads %', to_jsonb(row);
  end if;

  -- A create that fails gives its number back: no gap.
  begin
    perform pg_temp.push('mobile', null);
    raise exception 'undone';
  exception when raise_exception then
    if sqlerrm <> 'undone' then raise; end if;
  end;
  two := pg_temp.push('mobile', null);
  if two ->> 'prdId' <> 'mobile-2' then
    raise exception 'FAIL: the create after one undone answered %, not mobile-2', two ->> 'prdId';
  end if;
  insert into ids values ('mobile-2', (two ->> 'id')::uuid);

  -- A push by its number adds versions to that PRD, and the title follows the push.
  one := pg_temp.push('mobile', 1, '{"plan": "plan one", "before-after": "<p>b</p>"}');
  if one ->> 'id' <> (select id from ids where name = 'mobile-1')::text or one ->> 'prdId' <> 'mobile-1'
     or one -> 'added' <> '[{"kind": "plan", "version": 1}, {"kind": "before-after", "version": 1}]'::jsonb then
    raise exception 'FAIL: a push to mobile-1 answered %', one;
  end if;
  -- The repository only says which workspace: it is no key.
  if pg_temp.push('mobile', 1, '{}', 'pk-org/app') ->> 'id' <> (select id from ids where name = 'mobile-1')::text then
    raise exception 'FAIL: a push naming a repository reached another PRD';
  end if;
end $$;
select pg_temp.refused($$select pg_temp.push('mobile', 99)$$, 'P0002', 'a push reached a product PRD that does not exist', 'No PRD mobile-99 on Mobile.');

-- The opener cannot delete it: it is no draft.
do $$
begin
  delete from public.dossiers d where d.id = (select id from ids where name = 'mobile-2');
  if not exists (select 1 from public.dossiers d where d.id = (select id from ids where name = 'mobile-2')) then
    raise exception 'FAIL: the opener deleted a product PRD';
  end if;
end $$;

-- ── Another workspace's mobile is its own ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000015481c1');
do $$
declare
  theirs jsonb;
begin
  if public.dossier_approval(null, 1, 'mobile') is not null then
    raise exception 'FAIL: another workspace read PK''s mobile-1';
  end if;
  theirs := pg_temp.push('mobile', null);
  if theirs ->> 'prdId' <> 'mobile-1' or theirs -> 'product' ->> 'name' <> 'Other' then
    raise exception 'FAIL: another workspace''s first product PRD answered %', theirs;
  end if;
  if public.dossier_approval(null, 1, 'mobile') ->> 'dossier' <> theirs ->> 'id' then
    raise exception 'FAIL: another workspace did not read its own mobile-1';
  end if;
  if exists (select 1 from public.dossiers d where d.id = (select id from ids where name = 'mobile-1')) then
    raise exception 'FAIL: another workspace read PK''s product PRD';
  end if;
end $$;
select pg_temp.refused($$select public.approval_request(null, 2, 'mobile')$$, 'P0002', 'another workspace asked about PK''s mobile-2', 'No dossier for PRD mobile-2.');
select pg_temp.sign_in('00000000-0000-4000-8000-0000015481d1');
do $$
begin
  if public.dossier_approval(null, 1, 'mobile') is not null then
    raise exception 'FAIL: an account in no workspace read a product PRD';
  end if;
end $$;
select pg_temp.refused($$select pg_temp.push('mobile', null)$$, 'P0002', 'an account in no workspace created a product PRD');

-- ── Approving it by its key ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000015481b1');
do $$
declare
  dossier uuid := (select id from ids where name = 'mobile-1');
  made jsonb;
  asked jsonb;
  read jsonb;
begin
  if public.dossier_approval(null, 1, 'mobile') <> jsonb_build_object('dossier', dossier, 'approval', null) then
    raise exception 'FAIL: mobile-1 with no approval read %', public.dossier_approval(null, 1, 'mobile');
  end if;
  asked := public.approval_request(null, 1, 'mobile');
  if asked ->> 'dossier' <> dossier::text or asked ->> 'prdId' <> 'mobile-1' or asked ->> 'product' <> 'Mobile'
     or asked -> 'repo' <> 'null'::jsonb or asked -> 'prd' <> 'null'::jsonb or asked ->> 'title' <> 'Offline photos' then
    raise exception 'FAIL: asking about mobile-1 answered %', asked;
  end if;
  made := public.dossier_approve(dossier);
  if made ->> 'prdId' <> 'mobile-1' or made -> 'repo' <> 'null'::jsonb or made -> 'prd' <> 'null'::jsonb then
    raise exception 'FAIL: approving mobile-1 answered %', made;
  end if;
  read := public.dossier_approval(null, 1, 'mobile');
  if read ->> 'dossier' <> dossier::text
     or (select jsonb_agg(f ->> 'kind') from jsonb_array_elements(read -> 'approval' -> 'files') f) <> '["spec", "plan", "before-after"]'::jsonb then
    raise exception 'FAIL: mobile-1''s approval read %', read;
  end if;
  -- The key is matched as written: a key out of shape finds nothing.
  if public.dossier_approval(null, 1, 'Mobile') is not null then
    raise exception 'FAIL: an upper-case key found a product PRD';
  end if;
end $$;
select pg_temp.refused($$select public.dossier_approve((select id from ids where name = 'mobile-2'))$$, '22023', 'a product PRD with no spec was approved', 'PRD mobile-2 has no spec, plan, before-after yet: push it first.');
select pg_temp.refused($$select public.approval_request(null, 99, 'mobile')$$, 'P0002', 'a product PRD that does not exist was asked about', 'No dossier for PRD mobile-99.');

-- ── The approval stream reads it as the caller ──
do $$
declare
  dossier uuid := (select id from ids where name = 'mobile-1');
begin
  if (select d.id from public.dossiers d join public.products p on p.id = d.product_id
       where p.key = 'mobile' and d.product_seq = 1 and p.workspace_id = '00000000-0000-4000-8000-000001548100') is distinct from dossier then
    raise exception 'FAIL: a member did not read mobile-1 by its key';
  end if;
  if (select count(*) from public.approvals a where a.dossier_id = dossier) <> 1
     or (select count(*) from public.approval_requests r where r.dossier_id = dossier) <> 1 then
    raise exception 'FAIL: a member did not read mobile-1''s approval and request';
  end if;
  if jsonb_array_length(public.approval_people(dossier)) <> 1 then
    raise exception 'FAIL: mobile-1''s people read %', public.approval_people(dossier);
  end if;
end $$;

-- ── A PRD of a repository is found by its number, as before ──
do $$
declare
  repo_prd jsonb;
begin
  repo_prd := public.dossier_push('pk-org/app', 1, 'Repo one', null, '[{"kind": "spec", "content": "# One"}]');
  if repo_prd ? 'prdId' then
    raise exception 'FAIL: a PRD of a repository has a product PRD id: %', repo_prd;
  end if;
  if public.dossier_approval('pk-org/app', 1) ->> 'dossier' <> repo_prd ->> 'id' then
    raise exception 'FAIL: PRD 1 of pk-org/app was not found by its number';
  end if;
  if (select home_repo from public.dossiers where id = (repo_prd ->> 'id')::uuid) <> 'pk-org/app'
     or (select product_seq from public.dossiers where id = (repo_prd ->> 'id')::uuid) is not null then
    raise exception 'FAIL: a PRD of a repository is keyed by a product';
  end if;
  if public.dossier_approval('pk-org/app', 2) is not null then
    raise exception 'FAIL: a repository number found the product PRD mobile-2';
  end if;
end $$;
reset role;

-- ── One key per dossier, fixed for life ──
select pg_temp.refused($$insert into public.dossiers (workspace_id, home_repo, kind, product_id, product_seq, title)
  values ('00000000-0000-4000-8000-000001548100', 'pk-org/app', 'prd', '00000000-0000-4000-8000-0000015481e1', 7, 'Both')$$,
  '23514', 'a dossier keyed by its repository and its product was written');
select pg_temp.refused($$insert into public.dossiers (workspace_id, kind, title)
  values ('00000000-0000-4000-8000-000001548100', 'prd', 'Neither')$$, '23514', 'a dossier keyed by nothing was written');
select pg_temp.refused($$insert into public.dossiers (workspace_id, kind, product_id, product_seq, prd, title, numbered_at)
  values ('00000000-0000-4000-8000-000001548100', 'prd', '00000000-0000-4000-8000-0000015481e1', 7, 7, 'Two numbers', now())$$,
  '23514', 'a product PRD with a repository number was written');
select pg_temp.refused($$insert into public.dossiers (workspace_id, kind, product_id, product_seq, prd, title, numbered_at)
  values ('00000000-0000-4000-8000-000001548100', 'bug', '00000000-0000-4000-8000-0000015481e1', 7, null, 'A bug', now())$$,
  '23514', 'a product dossier of another kind was written');
select pg_temp.refused($$insert into public.dossiers (workspace_id, kind, product_id, product_seq, title)
  values ('00000000-0000-4000-8000-000001548100', 'prd', '00000000-0000-4000-8000-0000015481e1', 7, 'Unnumbered')$$,
  '23514', 'a product PRD with no numbering time was written');
select pg_temp.refused($$insert into public.dossiers (workspace_id, kind, product_id, product_seq, title, numbered_at)
  values ('00000000-0000-4000-8000-000001548100', 'prd', '00000000-0000-4000-8000-0000015481e1', 1, 'Again', now())$$,
  '23505', 'a second mobile-1 was written');
select pg_temp.refused($$update public.dossiers set product_seq = 9 where id = (select id from ids where name = 'mobile-1')$$,
  '22023', 'a product PRD''s number changed');
select pg_temp.refused($$update public.dossiers set product_id = '00000000-0000-4000-8000-0000015481e2' where id = (select id from ids where name = 'mobile-1')$$,
  '22023', 'a product PRD moved to another product');
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000015481b1');
select pg_temp.refused($$select public.dossier_set_product((select id from ids where name = 'mobile-2'), '00000000-0000-4000-8000-0000015481e2')$$,
  '22023', 'a member moved a product PRD to another product');
reset role;

-- ── The down script refuses while a product PRD exists ──
select pg_temp.refused($$select public.product_prd_ids_rollback_guard()$$, '55000', 'the rollback guard let a product PRD go');
do $$
begin
  begin
    delete from public.dossiers d where d.product_seq is not null;
    perform public.product_prd_ids_rollback_guard();
    raise exception 'guard passed';
  exception when raise_exception then
    if sqlerrm <> 'guard passed' then raise; end if;
  end;
end $$;

rollback;

-- ── Two creates at once: two numbers, no gap ──
-- Two sessions push a new Mobile PRD together: the first holds the product's row until it commits, the
-- second waits on it, then takes the next number. The rows are committed (each session must see them)
-- and deleted at the end.
begin;
create extension if not exists dblink schema extensions;
do $$
declare
  link   constant text := 'host=db port=5432 dbname=postgres user=postgres password=postgres';
  setup  constant text := $s$
    delete from public.workspaces where id = '00000000-0000-4000-8000-000001548200';
    delete from auth.users where id = '00000000-0000-4000-8000-0000015482a1';
    insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000015482a1', 'race@pk.test');
    insert into public.workspaces (id, slug, name, github_org) values ('00000000-0000-4000-8000-000001548200', 'pk-race', 'PK Race', 'pk-race');
    insert into public.workspace_members (workspace_id, user_id, role) values ('00000000-0000-4000-8000-000001548200', '00000000-0000-4000-8000-0000015482a1', 'owner');
    insert into public.businesses (id, workspace_id, name) values ('00000000-0000-4000-8000-0000015482f0', '00000000-0000-4000-8000-000001548200', 'PK Race');
    insert into public.products (id, workspace_id, business_id, name, key) values
      ('00000000-0000-4000-8000-0000015482e1', '00000000-0000-4000-8000-000001548200', '00000000-0000-4000-8000-0000015482f0', 'Mobile', 'mobile');
  $s$;
  teardown constant text := $s$
    delete from public.workspaces where id = '00000000-0000-4000-8000-000001548200';
    delete from auth.users where id = '00000000-0000-4000-8000-0000015482a1';
  $s$;
  as_race constant text := $s$
    begin;
    set local role authenticated;
    set local request.jwt.claims to '{"sub": "00000000-0000-4000-8000-0000015482a1", "role": "authenticated"}';
  $s$;
  create_one constant text := $s$select public.dossier_push(null, null, 'Race', null, '[]', 'prd', null, 'mobile') ->> 'prdId'$s$;
  first  text;
  second text;
  busy   integer;
begin
  perform extensions.dblink_connect('pk_setup', link);
  perform extensions.dblink_exec('pk_setup', setup);
  perform extensions.dblink_connect('pk_one', link);
  perform extensions.dblink_connect('pk_two', link);
  begin
    perform extensions.dblink_exec('pk_one', as_race);
    perform extensions.dblink_exec('pk_two', as_race);
    select r into first from extensions.dblink('pk_one', create_one) as t (r text);
    perform extensions.dblink_send_query('pk_two', create_one);
    perform pg_sleep(0.3);
    busy := extensions.dblink_is_busy('pk_two');
    perform extensions.dblink_exec('pk_one', 'commit');
    select r into second from extensions.dblink_get_result('pk_two') as t (r text);
    perform * from extensions.dblink_get_result('pk_two') as t (r text);
    perform extensions.dblink_exec('pk_two', 'commit');
    if busy <> 1 then
      raise exception 'FAIL: the second create did not wait on the first';
    end if;
    if first <> 'mobile-1' or second <> 'mobile-2' then
      raise exception 'FAIL: two creates at once took % and %, not mobile-1 and mobile-2', first, second;
    end if;
    if (select count(*) from extensions.dblink('pk_setup',
          $s$select product_seq from public.dossiers where product_id = '00000000-0000-4000-8000-0000015482e1'$s$) as t (n integer)) <> 2 then
      raise exception 'FAIL: two creates at once did not leave two PRDs';
    end if;
  exception when others then
    perform extensions.dblink_disconnect('pk_one');
    perform extensions.dblink_disconnect('pk_two');
    perform extensions.dblink_exec('pk_setup', teardown);
    perform extensions.dblink_disconnect('pk_setup');
    raise;
  end;
  perform extensions.dblink_disconnect('pk_one');
  perform extensions.dblink_disconnect('pk_two');
  perform extensions.dblink_exec('pk_setup', teardown);
  perform extensions.dblink_disconnect('pk_setup');
end $$;
rollback;

select 'product_prd_ids: every check passed' as result;
