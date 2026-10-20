-- Archive a product (PRD 2232 s1, 20261217100000_archive_product.sql). The supabase workflow runs it on
-- every pull request, after `supabase db start` has applied the migrations and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/product_archive.sql
-- Only an owner of the workspace archives and restores a product (42501 a member, P0002 no such product);
-- archive sets archived_at and archived_by, twice answers the same row, and restore clears both. A member no
-- longer reads the archived product; an owner still does. Every lookup the kit and agents use skips it,
-- the owner's included, and the reads say so in words; a call that names it, by key or by id, is refused
-- with P0002 and the archived message. Nothing under it is erased, and after restore every lookup finds it
-- again. One transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

-- ── The cast ──
-- Olga owns Archway, Max is a member. Archway sells Shelf (key shelf), alone in archway/shelf, and Crate
-- (key crate); archway/both is in both.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000022320a1', 'olga@archway.test'),
  ('00000000-0000-4000-8000-0000022320b1', 'max@archway.test');
insert into public.workspaces (id, slug, name, github_org) values
  ('00000000-0000-4000-8000-000002232100', 'archway', 'Archway', 'archway');
insert into public.workspace_members (workspace_id, user_id, role) values
  ('00000000-0000-4000-8000-000002232100', '00000000-0000-4000-8000-0000022320a1', 'owner'),
  ('00000000-0000-4000-8000-000002232100', '00000000-0000-4000-8000-0000022320b1', 'member');
insert into public.businesses (workspace_id, name) values ('00000000-0000-4000-8000-000002232100', 'Archway');
insert into public.products (id, workspace_id, business_id, name, key)
select x.id::uuid, b.workspace_id, b.id, x.name, x.key
  from (values ('00000000-0000-4000-8000-0000022321f1', 'Shelf', 'shelf'),
               ('00000000-0000-4000-8000-0000022321f2', 'Crate', 'crate')) as x (id, name, key)
  join public.businesses b on b.workspace_id = '00000000-0000-4000-8000-000002232100';
insert into public.repositories (workspace_id, full_name) values
  ('00000000-0000-4000-8000-000002232100', 'archway/shelf'),
  ('00000000-0000-4000-8000-000002232100', 'archway/both'),
  ('00000000-0000-4000-8000-000002232100', 'archway/spare');
insert into public.product_repositories (product_id, workspace_id, repository, added_by) values
  ('00000000-0000-4000-8000-0000022321f1', '00000000-0000-4000-8000-000002232100', 'archway/shelf', 'person'),
  ('00000000-0000-4000-8000-0000022321f1', '00000000-0000-4000-8000-000002232100', 'archway/both', 'person'),
  ('00000000-0000-4000-8000-0000022321f2', '00000000-0000-4000-8000-000002232100', 'archway/both', 'person');

create function pg_temp.hash(token text) returns text language sql immutable as $$
  select encode(sha256(convert_to(token, 'UTF8')), 'hex');
$$;
-- Olga's business link.
insert into public.agent_tokens (workspace_id, made_by, name, token_hash, last_four, scope)
values ('00000000-0000-4000-8000-000002232100', '00000000-0000-4000-8000-0000022320a1', 'olga live',
        pg_temp.hash('omb_archway_olga_0001'), '0001', 'business');

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
-- Runs a call that must be refused with `code`, its message holding `words` when given.
create function pg_temp.refused(stmt text, code text, why text, words text default null) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % ran: %', why, stmt;
exception when others then
  if sqlstate <> code then raise exception 'FAIL: % answered % (%), not %', why, sqlstate, sqlerrm, code; end if;
  if words is not null and position(words in sqlerrm) = 0 then
    raise exception 'FAIL: % said "%", not naming "%"', why, sqlerrm, words;
  end if;
end;
$$;
grant execute on function pg_temp.hash(text) to authenticated;
grant execute on function pg_temp.refused(text, text, text, text) to authenticated;

-- ── Who may call what ──
do $$
begin
  if has_function_privilege('anon', 'public.product_archive(uuid)', 'execute')
     or has_function_privilege('anon', 'public.product_restore(uuid)', 'execute') then
    raise exception 'FAIL: signed out, archive or restore may be called';
  end if;
  if not has_function_privilege('authenticated', 'public.product_archive(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.product_restore(uuid)', 'execute') then
    raise exception 'FAIL: signed in, archive or restore cannot be called';
  end if;
  if has_function_privilege('authenticated', 'public.product_live(public.products)', 'execute')
     or has_function_privilege('authenticated', 'public.product_owner_of(uuid, text)', 'execute')
     or has_function_privilege('authenticated', 'public.product_archived_for(uuid, text, integer)', 'execute')
     or has_function_privilege('authenticated', 'public.business_archived(uuid, public.products)', 'execute') then
    raise exception 'FAIL: an internal helper of the archive is callable by a signed-in person';
  end if;
end $$;

-- The internal lookups (product_of_key(), lookup_product(), repository_only_product()) are callable by no
-- signed-in person: blocks that call them run as the check's own role, with the person's claims set, so
-- auth.uid() is theirs. Row-level security and the grants are checked as `authenticated`.

-- ── Before: Shelf is live, with content to keep ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000022320a1');
do $$
declare
  ws constant uuid := '00000000-0000-4000-8000-000002232100';
  shelf constant uuid := '00000000-0000-4000-8000-0000022321f1';
begin
  perform public.product_legal_add(ws, shelf, 'VAT', 'Every invoice shows its VAT rate.', 'VAT Code, art. 53');
  perform public.product_glossary_add(ws, shelf, 'Quote', 'A priced offer the customer may accept.');
  perform public.constituent_add(ws, shelf, 'never', 'Never sell the data.');
  if (public.business_for_repo('archway/shelf') -> 'legal') = '[]'::jsonb then
    raise exception 'FAIL: before archive, archway/shelf reads no Legal entry';
  end if;
  if (public.product_of_key('shelf')).id is distinct from shelf then
    raise exception 'FAIL: before archive, the key shelf finds no product';
  end if;
end $$;

-- ── Who may archive ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000022320b1');
select pg_temp.refused('select public.product_archive(''00000000-0000-4000-8000-0000022321f1'')', '42501', 'a member archives', 'Only an owner');
select pg_temp.refused('select public.product_restore(''00000000-0000-4000-8000-0000022321f1'')', '42501', 'a member restores', 'Only an owner');
select set_config('request.jwt.claims', json_build_object('role', 'authenticated')::text, true);
select pg_temp.refused('select public.product_archive(''00000000-0000-4000-8000-0000022321f1'')', '42501', 'signed out, one archives', 'Sign in');
select pg_temp.sign_in('00000000-0000-4000-8000-0000022320a1');
select pg_temp.refused('select public.product_archive(''00000000-0000-4000-8000-0000022329ff'')', 'P0002', 'archiving no such product');
select pg_temp.refused('select public.product_restore(''00000000-0000-4000-8000-0000022329ff'')', 'P0002', 'restoring no such product');

-- ── Olga archives Shelf ──
do $$
declare
  first jsonb;
  again jsonb;
  row public.products;
begin
  first := public.product_archive('00000000-0000-4000-8000-0000022321f1');
  if first ->> 'id' <> '00000000-0000-4000-8000-0000022321f1' or first ->> 'name' <> 'Shelf' or first ->> 'archivedAt' is null then
    raise exception 'FAIL: archive answered %', first;
  end if;
  select p.* into row from public.products p where p.id = '00000000-0000-4000-8000-0000022321f1';
  if row.archived_at is null or row.archived_by is distinct from '00000000-0000-4000-8000-0000022320a1'::uuid then
    raise exception 'FAIL: archive set archived_at % and archived_by %', row.archived_at, row.archived_by;
  end if;
  again := public.product_archive('00000000-0000-4000-8000-0000022321f1');
  if again is distinct from first then
    raise exception 'FAIL: archiving twice answered % then %', first, again;
  end if;
end $$;

-- ── Who reads it ──
do $$
begin
  if not exists (select 1 from public.products p where p.id = '00000000-0000-4000-8000-0000022321f1') then
    raise exception 'FAIL: the owner no longer reads the archived product';
  end if;
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000022320b1');
do $$
begin
  if exists (select 1 from public.products p where p.id = '00000000-0000-4000-8000-0000022321f1') then
    raise exception 'FAIL: a member still reads the archived product';
  end if;
  if not exists (select 1 from public.products p where p.id = '00000000-0000-4000-8000-0000022321f2') then
    raise exception 'FAIL: a member no longer reads the live product beside it';
  end if;
end $$;

-- ── Every lookup skips it, the owner's too ──
reset role;
select pg_temp.sign_in('00000000-0000-4000-8000-0000022320a1');
do $$
declare
  ws constant uuid := '00000000-0000-4000-8000-000002232100';
  read jsonb;
begin
  if public.repository_only_product(ws, 'archway/shelf') is not null then
    raise exception 'FAIL: repository_only_product() still finds the archived product';
  end if;
  if public.repository_only_product(ws, 'archway/both') is distinct from '00000000-0000-4000-8000-0000022321f2'::uuid then
    raise exception 'FAIL: archway/both does not resolve to its other, live, product';
  end if;
  if public.lookup_product(ws, 'archway/shelf') is not null then
    raise exception 'FAIL: lookup_product() still finds the archived product';
  end if;
  read := public.business_for_repo('archway/shelf');
  if read ->> 'state' <> 'archived' or read -> 'product' ->> 'name' <> 'Shelf'
     or read -> 'legal' <> '[]'::jsonb or read -> 'glossary' <> '[]'::jsonb or read -> 'claims' <> '[]'::jsonb then
    raise exception 'FAIL: business_for_repo() of a repository whose product is archived answered %', read;
  end if;
  read := public.business_for_repo('archway/both');
  if read ->> 'state' = 'archived' then
    raise exception 'FAIL: a repository with another live product reads archived: %', read;
  end if;
  read := public.business_for_token(pg_temp.hash('omb_archway_olga_0001'), 'archway/shelf');
  if read ->> 'state' <> 'archived' or read -> 'product' ->> 'name' <> 'Shelf' or read -> 'legal' <> '[]'::jsonb then
    raise exception 'FAIL: business_for_token() of a repository whose product is archived answered %', read;
  end if;
  read := public.business_for_token(pg_temp.hash('omb_archway_olga_0001'));
  if read -> 'legal' <> '[]'::jsonb or read ->> 'state' = 'archived' then
    raise exception 'FAIL: business_for_token() with no repository reads the archived product: %', read;
  end if;
end $$;
select pg_temp.refused('select public.product_of_key(''shelf'')', 'P0002', 'product_of_key() of an archived product',
  'Product Shelf is archived: an owner restores it on its page.');
set local role authenticated;
select pg_temp.refused(
  'select public.product_knowledge_of(''00000000-0000-4000-8000-000002232100'', ''00000000-0000-4000-8000-0000022321f1'')',
  'P0002', 'product_knowledge_of() of an archived product', 'Product Shelf is archived: an owner restores it on its page.');
select pg_temp.refused('select public.knowledge_graph_for_token(pg_temp.hash(''omb_archway_olga_0001''), ''archway/shelf'')',
  'P0002', 'knowledge_graph_for_token() of a repository whose product is archived',
  'Product Shelf is archived: an owner restores it on its page.');
do $$
declare
  read jsonb := public.knowledge_graph_for_token(pg_temp.hash('omb_archway_olga_0001'));
begin
  if read -> 'product' ->> 'name' <> 'Crate' then
    raise exception 'FAIL: with no repository, the link reads % and not the one live product', read -> 'product';
  end if;
end $$;

-- ── Nothing changes it ──
set local role authenticated;
select pg_temp.refused(
  'select public.product_legal_add(''00000000-0000-4000-8000-000002232100'', ''00000000-0000-4000-8000-0000022321f1'', ''VAT'', ''A new rule.'', ''VAT Code'')',
  'P0002', 'a Legal entry added to an archived product', 'Product Shelf is archived: an owner restores it on its page.');
select pg_temp.refused(
  'select public.product_glossary_add(''00000000-0000-4000-8000-000002232100'', ''00000000-0000-4000-8000-0000022321f1'', ''Invoice'', ''A bill.'')',
  'P0002', 'a term added to an archived product', 'Product Shelf is archived: an owner restores it on its page.');
select pg_temp.refused(
  'select public.product_repository_link(''00000000-0000-4000-8000-0000022321f1'', ''archway/spare'')',
  'P0002', 'a repository linked to an archived product', 'Product Shelf is archived: an owner restores it on its page.');
select pg_temp.refused(
  'select public.dossier_push(null, null, ''Offline photos'', null, ''[]''::jsonb, ''prd'', null, ''shelf'')',
  'P0002', 'a product PRD pushed to an archived product', 'Product Shelf is archived: an owner restores it on its page.');

-- ── Nothing under it is erased ──
reset role;
do $$
declare
  shelf constant uuid := '00000000-0000-4000-8000-0000022321f1';
begin
  if (select count(*) from public.product_repositories l where l.product_id = shelf) <> 2
     or (select count(*) from public.product_legal l where l.product_id = shelf) <> 1
     or (select count(*) from public.product_glossary g where g.product_id = shelf) <> 1
     or (select count(*) from public.constituent_events e join public.constituents c on c.id = e.constituent_id where c.product_id = shelf) = 0
     or (select count(*) from public.product_knowledge_events e where e.product_id = shelf) = 0 then
    raise exception 'FAIL: archiving erased a row under the product';
  end if;
end $$;

-- ── Olga restores it: every lookup finds it again ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000022320a1');
do $$
declare
  back jsonb;
begin
  back := public.product_restore('00000000-0000-4000-8000-0000022321f1');
  if back ->> 'id' <> '00000000-0000-4000-8000-0000022321f1' or back -> 'archivedAt' <> 'null'::jsonb then
    raise exception 'FAIL: restore answered %', back;
  end if;
  if public.product_restore('00000000-0000-4000-8000-0000022321f1') is distinct from back then
    raise exception 'FAIL: restoring a live product changed it';
  end if;
end $$;
reset role;
do $$
declare
  ws constant uuid := '00000000-0000-4000-8000-000002232100';
  shelf constant uuid := '00000000-0000-4000-8000-0000022321f1';
  row public.products;
  read jsonb;
begin
  select p.* into row from public.products p where p.id = shelf;
  if row.archived_at is not null or row.archived_by is not null then
    raise exception 'FAIL: restore left archived_at % and archived_by %', row.archived_at, row.archived_by;
  end if;
  if public.lookup_product(ws, 'archway/shelf') is distinct from shelf
     or public.repository_only_product(ws, 'archway/shelf') is distinct from shelf
     or (public.product_of_key('shelf')).id is distinct from shelf then
    raise exception 'FAIL: after restore, a lookup does not find the product';
  end if;
  read := public.business_for_repo('archway/shelf');
  if read ->> 'state' = 'archived' or read -> 'legal' = '[]'::jsonb or read -> 'glossary' = '[]'::jsonb then
    raise exception 'FAIL: after restore, business_for_repo() answered %', read;
  end if;
  read := public.business_for_token(pg_temp.hash('omb_archway_olga_0001'), 'archway/shelf');
  if read -> 'legal' = '[]'::jsonb then
    raise exception 'FAIL: after restore, business_for_token() reads no Legal entry';
  end if;
  if public.knowledge_graph_for_token(pg_temp.hash('omb_archway_olga_0001'), 'archway/shelf') -> 'product' ->> 'name' <> 'Shelf' then
    raise exception 'FAIL: after restore, knowledge_graph_for_token() does not read the product';
  end if;
  if public.product_knowledge_of(ws, shelf) -> 'product' ->> 'name' <> 'Shelf' then
    raise exception 'FAIL: after restore, product_knowledge_of() does not read the product';
  end if;
  if public.repository_only_product(ws, 'archway/both') is not null then
    raise exception 'FAIL: after restore, archway/both reads one product, not its two';
  end if;
end $$;
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000022320b1');
do $$
begin
  if not exists (select 1 from public.products p where p.id = '00000000-0000-4000-8000-0000022321f1') then
    raise exception 'FAIL: after restore, a member does not read the product';
  end if;
end $$;

rollback;
