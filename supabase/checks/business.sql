-- Who may read and write a workspace's business, and what agents read of it (PRD 748). The supabase
-- workflow runs it on every pull request, after `supabase db start` has applied the migrations and the
-- demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/business.sql
-- Any member of a workspace opens its business, picks, suggests, confirms and rejects claims, adds and
-- renames products, points a repository at a product, and cites claims, all through the functions of
-- 20261017090000_business_store.sql; a member of another workspace and anyone signed out are refused
-- (42501), and a bad kind or value is refused (22023). Opening the business points every repository
-- at its first product. business_for_repo() returns confirmed claims only: the region from the
-- business and the rest from the repository's product, the business's claims only when the repository
-- has none. Nobody writes the four tables directly, and nobody updates or deletes a citation. Nothing
-- is seeded. One transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

-- ── Nothing seeded ──
do $$
begin
  if exists (select 1 from public.businesses) or exists (select 1 from public.products) or exists (select 1 from public.claims) then
    raise exception 'FAIL: a business, product or claim exists before anyone opened a page';
  end if;
  if exists (select 1 from public.repositories where product_id is not null) then
    raise exception 'FAIL: a repository points at a product before any business exists';
  end if;
end $$;

-- ── The cast ──
-- Olga and Mo are members of Vertuoza (github_org vertuoza); Carl owns Acme; Sam belongs to no
-- workspace.
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000074a1', 'olga@vertuoza.com', now()),
  ('00000000-0000-4000-8000-0000000074b1', 'mo@vertuoza.com', now()),
  ('00000000-0000-4000-8000-0000000074c1', 'carl@acme.test', now()),
  ('00000000-0000-4000-8000-0000000074d1', 'sam@nowhere.test', now());
insert into public.workspaces (slug, name, github_org) values ('acme-biz', 'Acme', 'acme-biz');
update public.workspaces set github_org = 'vertuoza' where slug = 'vertuoza' and github_org is null;
insert into public.workspace_members (workspace_id, user_id, role)
select w.id, m.user_id, m.role
  from (values
         ('vertuoza', '00000000-0000-4000-8000-0000000074a1'::uuid, 'owner'),
         ('vertuoza', '00000000-0000-4000-8000-0000000074b1'::uuid, 'member'),
         ('acme-biz', '00000000-0000-4000-8000-0000000074c1'::uuid, 'owner')
       ) as m (slug, user_id, role)
  join public.workspaces w on w.slug = m.slug
on conflict (workspace_id, user_id) do nothing;

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create temporary table ids (slug text primary key, id uuid);
insert into ids select w.slug, w.id from public.workspaces w where w.slug in ('vertuoza', 'acme-biz');
grant select on ids to anon, authenticated, service_role;
create function pg_temp.ws(slug text) returns uuid language sql as $$
  select i.id from ids i where i.slug = ws.slug;
$$;
-- What the member made, read back by later blocks and outsiders' calls.
create temporary table made (name text primary key, id uuid);
grant select, insert, update on made to anon, authenticated, service_role;
create function pg_temp.made(name text) returns uuid language sql as $$
  select m.id from made m where m.name = made.name;
$$;
-- Runs a call that must be refused to its caller.
create function pg_temp.forbidden(stmt text, who text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % ran for %', stmt, who;
exception when insufficient_privilege then null;
end;
$$;
-- Runs a call that must be refused as invalid.
create function pg_temp.invalid(stmt text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % was taken', stmt;
exception when invalid_parameter_value then null;
end;
$$;
-- Everything the store holds, as one value to compare before and after a refusal.
create function pg_temp.store() returns text language sql security definer as $$
  select concat_ws('|',
    (select string_agg(row(b.*)::text, ';' order by b.id) from public.businesses b),
    (select string_agg(row(p.*)::text, ';' order by p.id) from public.products p),
    (select string_agg(row(c.*)::text, ';' order by c.id) from public.claims c),
    (select string_agg(row(c.*)::text, ';' order by c.id) from public.claim_citations c),
    (select string_agg(r.full_name || ':' || coalesce(r.product_id::text, '-'), ';' order by r.full_name) from public.repositories r));
$$;

-- ── Signed out: no function runs, nothing is read ──
set local role anon;
do $$
declare c text;
begin
  foreach c in array array[
    format('select public.business_open(%L)', pg_temp.ws('vertuoza')),
    'select public.business_for_repo(''vertuoza/vertuo-apps'')',
    'select public.claims_cite(''vertuoza/vertuo-apps'', array[''rival#1''], ''think-big'', null)'
  ] loop perform pg_temp.forbidden(c, 'anon'); end loop;
  begin perform 1 from public.claims; raise exception 'FAIL: anon read public.claims';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.claim_citations; raise exception 'FAIL: anon read public.claim_citations';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── A member of Vertuoza reads none before the business is opened ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000074b1');
do $$
declare got jsonb;
begin
  got := public.business_for_repo('vertuoza/vertuo-apps');
  if got <> '{"state": "none", "business": null, "product": null, "claims": []}'::jsonb then
    raise exception 'FAIL: business_for_repo with no business answered %', got;
  end if;
  begin
    perform public.claim_pick(pg_temp.ws('vertuoza'), null, 'region', 'Belgium', 'pick');
    raise exception 'FAIL: claim_pick ran before the business was opened';
  exception when no_data_found then null; end;
end $$;

-- ── Mo, a member (not the owner), opens the business and picks ──
do $$
declare
  b public.businesses;
  again public.businesses;
  first uuid;
  c public.claims;
begin
  b := public.business_open(pg_temp.ws('vertuoza'));
  if b.name is distinct from (select w.name from public.workspaces w where w.id = pg_temp.ws('vertuoza')) then
    raise exception 'FAIL: the business is not named after its workspace: %', b;
  end if;
  again := public.business_open(pg_temp.ws('vertuoza'));
  if again.id <> b.id or (select count(*) from public.businesses) <> 1 or (select count(*) from public.products) <> 1 then
    raise exception 'FAIL: opening the business twice made a second business or product';
  end if;
  select p.id into first from public.products p where p.business_id = b.id;
  insert into made values ('erp', first);
  if exists (select 1 from public.repositories r where r.workspace_id = pg_temp.ws('vertuoza') and r.product_id is distinct from first) then
    raise exception 'FAIL: business_open did not point every repository at the first product';
  end if;

  c := public.claim_pick(pg_temp.ws('vertuoza'), null, 'region', ' Belgium ', 'pick');
  if c.seq <> 1 or c.kind <> 'region' or c.value <> 'Belgium' or c.source <> 'pick' or c.state <> 'confirmed' or c.product_id is not null then
    raise exception 'FAIL: a picked region is not region#1, confirmed, on the business: %', c;
  end if;
  -- A region takes no product, even when one is sent.
  c := public.claim_pick(pg_temp.ws('vertuoza'), first, 'region', 'France', 'pick');
  if c.product_id is not null or c.seq <> 2 then raise exception 'FAIL: a region was put on a product: %', c; end if;
  c := public.claim_pick(pg_temp.ws('vertuoza'), first, 'offering', 'ERP', 'pick');
  if c.seq <> 3 or c.product_id <> first then raise exception 'FAIL: offering is not #3 on the product: %', c; end if;
  c := public.claim_pick(pg_temp.ws('vertuoza'), first, 'size', '2-50', 'pick');
  if c.seq <> 4 or c.value <> '2-50' then raise exception 'FAIL: size 2-50 not stored as #4: %', c; end if;
  c := public.claim_pick(pg_temp.ws('vertuoza'), first, 'size', '500-1000+', 'pick');
  c := public.claim_pick(pg_temp.ws('vertuoza'), first, 'trade', 'construction', 'pick');
  c := public.claim_pick(pg_temp.ws('vertuoza'), first, 'rival', 'Rival One', 'pick');
  insert into made values ('rival-one', c.id);
  -- A pick of a value already there adds nothing.
  if (public.claim_pick(pg_temp.ws('vertuoza'), first, 'rival', 'rival one', 'pick')).id <> c.id then
    raise exception 'FAIL: picking a value again made a second claim';
  end if;

  -- Suggested rivals: proposed until confirmed.
  c := public.claim_pick(pg_temp.ws('vertuoza'), first, 'rival', 'Rival Two', 'suggestion');
  if c.source <> 'suggestion' or c.state <> 'proposed' then raise exception 'FAIL: a suggestion is not proposed: %', c; end if;
  insert into made values ('rival-two', c.id);
  c := public.claim_pick(pg_temp.ws('vertuoza'), first, 'rival', 'Rival Three', 'suggestion');
  insert into made values ('rival-three', c.id);
  c := public.claim_set_state(pg_temp.ws('vertuoza'), pg_temp.made('rival-two'), 'confirmed');
  if c.state <> 'confirmed' then raise exception 'FAIL: ✓ did not confirm a suggestion'; end if;
  c := public.claim_set_state(pg_temp.ws('vertuoza'), pg_temp.made('rival-three'), 'rejected');
  if c.state <> 'rejected' then raise exception 'FAIL: ✗ did not reject a suggestion'; end if;
  -- A rejected rival, suggested again, stays rejected.
  c := public.claim_pick(pg_temp.ws('vertuoza'), first, 'rival', 'Rival Three', 'suggestion');
  if c.state <> 'rejected' or c.id <> pg_temp.made('rival-three') then raise exception 'FAIL: a rejected rival was proposed again: %', c; end if;

  if (select string_agg(c2.seq::text, ',' order by c2.seq) from public.claims c2) <> '1,2,3,4,5,6,7,8,9' then
    raise exception 'FAIL: seq does not count the business''s claims whatever their kind';
  end if;
end $$;

-- ── Bad kinds and values: 22023, nothing stored ──
do $$
declare c text;
begin
  create temporary table before_bad as select pg_temp.store() s;
  foreach c in array array[
    format('select public.claim_pick(%L, %L, ''colour'', ''red'', ''pick'')', pg_temp.ws('vertuoza'), pg_temp.made('erp')),
    format('select public.claim_pick(%L, %L, null, ''red'', ''pick'')', pg_temp.ws('vertuoza'), pg_temp.made('erp')),
    format('select public.claim_pick(%L, %L, ''trade'', ''   '', ''pick'')', pg_temp.ws('vertuoza'), pg_temp.made('erp')),
    format('select public.claim_pick(%L, %L, ''trade'', %L, ''pick'')', pg_temp.ws('vertuoza'), pg_temp.made('erp'), repeat('x', 81)),
    format('select public.claim_pick(%L, %L, ''trade'', %L, ''pick'')', pg_temp.ws('vertuoza'), pg_temp.made('erp'), E'two\nlines'),
    format('select public.claim_pick(%L, %L, ''size'', ''3-50'', ''pick'')', pg_temp.ws('vertuoza'), pg_temp.made('erp')),
    format('select public.claim_pick(%L, %L, ''size'', ''50-2'', ''pick'')', pg_temp.ws('vertuoza'), pg_temp.made('erp')),
    format('select public.claim_pick(%L, %L, ''size'', ''lots'', ''pick'')', pg_temp.ws('vertuoza'), pg_temp.made('erp')),
    format('select public.claim_pick(%L, %L, ''trade'', ''retail'', ''evidence'')', pg_temp.ws('vertuoza'), pg_temp.made('erp')),
    format('select public.claim_pick(%L, %L, ''trade'', ''retail'', ''suggestion'')', pg_temp.ws('vertuoza'), pg_temp.made('erp')),
    format('select public.claim_pick(%L, null, ''trade'', ''retail'', ''pick'')', pg_temp.ws('vertuoza')),
    format('select public.claim_set_state(%L, %L, ''contradicted'')', pg_temp.ws('vertuoza'), pg_temp.made('rival-one')),
    format('select public.product_add(%L, '''')', pg_temp.ws('vertuoza')),
    'select public.claims_cite(''vertuoza/vertuo-apps'', array[''rival-4''], ''think-big'', null)',
    'select public.claims_cite(''vertuoza/vertuo-apps'', array[]::text[], ''think-big'', null)',
    'select public.claims_cite(''vertuoza/vertuo-apps'', array[''rival#7''], '''', null)',
    'select public.business_for_repo(''not a repository'')'
  ] loop perform pg_temp.invalid(c); end loop;
  begin
    perform public.claims_cite('vertuoza/vertuo-apps', array['rival#7', 'rival#99'], 'think-big', null);
    raise exception 'FAIL: claims_cite took an id the business does not hold';
  exception when no_data_found then null; end;
  if pg_temp.store() <> (select s from before_bad) then
    raise exception 'FAIL: a refused call changed the store';
  end if;
end $$;

-- ── The citation log: appended through claims_cite, read by members ──
do $$
declare n integer;
begin
  n := public.claims_cite('Vertuoza/Vertuo-Apps', array['rival#7', 'region#1'], 'think-big', 'concept #9');
  if n <> 2 or (select count(*) from public.claim_citations) <> 2 then
    raise exception 'FAIL: claims_cite did not append two citations (%)', n;
  end if;
  if exists (select 1 from public.claim_citations where cited_by <> 'think-big' or ref <> 'concept #9'
               or cited_as <> '00000000-0000-4000-8000-0000000074b1'::uuid) then
    raise exception 'FAIL: a citation does not say who cited it, for which run';
  end if;
end $$;

-- ── Products, and repositories pointed at them ──
do $$
declare
  p public.products;
  r public.repositories;
begin
  p := public.product_add(pg_temp.ws('vertuoza'), 'Omni Loop');
  insert into made values ('omni', p.id);
  perform pg_temp.invalid(format('select public.product_add(%L, ''omni loop'')', pg_temp.ws('vertuoza')));
  p := public.product_rename(pg_temp.ws('vertuoza'), p.id, 'The Loop');
  if p.name <> 'The Loop' then raise exception 'FAIL: product_rename did not rename: %', p; end if;
  r := public.repository_set_product(pg_temp.ws('vertuoza'), 'vertuoza/vertuo-omni-loop', pg_temp.made('omni'));
  if r.product_id <> pg_temp.made('omni') then raise exception 'FAIL: repository_set_product did not point it: %', r; end if;
  begin
    perform public.repository_set_product(pg_temp.ws('vertuoza'), 'vertuoza/missing', pg_temp.made('omni'));
    raise exception 'FAIL: repository_set_product pointed a repository that is not listed';
  exception when no_data_found then null; end;
  perform public.claim_pick(pg_temp.ws('vertuoza'), pg_temp.made('omni'), 'offering', 'developer tool', 'pick');
end $$;
reset role;

-- A repository tracked later points at the first product (the owner adds it).
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000074a1');
do $$
declare r public.repositories;
begin
  r := public.add_repository(pg_temp.ws('vertuoza'), 'vertuoza/later-one');
  if r.product_id is distinct from pg_temp.made('erp') then
    raise exception 'FAIL: a repository tracked later does not point at the first product: %', r;
  end if;
end $$;

-- ── What agents read ──
do $$
declare got jsonb;
begin
  -- vertuo-apps, on the first product: its region and its product's confirmed claims, never a
  -- proposed or rejected one; `product` is named now there are two.
  got := public.business_for_repo('vertuoza/vertuo-apps');
  if got->>'state' <> 'ok' or got->'business'->>'name' is null or got->'product'->>'name' is distinct from
     (select w.name from public.workspaces w where w.id = pg_temp.ws('vertuoza')) then
    raise exception 'FAIL: business_for_repo on vertuo-apps: %', got;
  end if;
  if (select string_agg(c->>'id', ',') from jsonb_array_elements(got->'claims') c)
     <> 'region#1,region#2,offering#3,size#4,size#5,trade#6,rival#7,rival#8' then
    raise exception 'FAIL: business_for_repo on vertuo-apps listed %', got->'claims';
  end if;
  if (got->'claims'->0) <> '{"id": "region#1", "kind": "region", "value": "Belgium", "source": "pick", "receipt": null, "lastSeen": null}'::jsonb then
    raise exception 'FAIL: a claim does not read as decision 14''s shape: %', got->'claims'->0;
  end if;
  -- vertuo-omni-loop, on its own product: the region and that product's claims only.
  got := public.business_for_repo('vertuoza/vertuo-omni-loop');
  if got->'product'->>'name' <> 'The Loop'
     or (select string_agg(c->>'id', ',') from jsonb_array_elements(got->'claims') c) <> 'region#1,region#2,offering#10' then
    raise exception 'FAIL: business_for_repo on vertuo-omni-loop: %', got;
  end if;
end $$;
reset role;

-- A repository with no product reads the business's claims only.
update public.repositories set product_id = null
 where workspace_id = pg_temp.ws('vertuoza') and full_name = 'vertuoza/pdf-builder';
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000074a1');
do $$
declare got jsonb;
begin
  got := public.business_for_repo('vertuoza/pdf-builder');
  if got->'product' <> 'null'::jsonb or (select string_agg(c->>'id', ',') from jsonb_array_elements(got->'claims') c) <> 'region#1,region#2' then
    raise exception 'FAIL: a repository with no product: %', got;
  end if;
end $$;

-- ── Nobody writes the tables directly, and a citation is never rewritten ──
do $$
declare c text;
begin
  foreach c in array array[
    format('insert into public.businesses (workspace_id, name) values (%L, ''x'')', pg_temp.ws('acme-biz')),
    'update public.businesses set name = ''x''',
    'delete from public.products',
    'update public.claims set state = ''confirmed''',
    'delete from public.claims',
    'update public.claim_citations set cited_by = ''x''',
    'delete from public.claim_citations',
    'update public.repositories set product_id = null'
  ] loop perform pg_temp.forbidden(c, 'a member, directly'); end loop;
end $$;
reset role;

set local role service_role;
do $$
begin
  begin update public.claim_citations set cited_by = 'x'; raise exception 'FAIL: the service role updated a citation';
  exception when insufficient_privilege then null; end;
  begin delete from public.claim_citations; raise exception 'FAIL: the service role deleted a citation';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Another workspace's member and a stranger: refused, read nothing ──
create temporary table before_outsiders as select pg_temp.store() s;
grant select on before_outsiders to authenticated;
set local role authenticated;
do $$
declare
  who text;
  c text;
begin
  foreach who in array array['00000000-0000-4000-8000-0000000074c1', '00000000-0000-4000-8000-0000000074d1'] loop
    perform pg_temp.sign_in(who);
    foreach c in array array[
      format('select public.business_open(%L)', pg_temp.ws('vertuoza')),
      format('select public.claim_pick(%L, %L, ''rival'', ''Planted'', ''pick'')', pg_temp.ws('vertuoza'), pg_temp.made('erp')),
      format('select public.claim_set_state(%L, %L, ''rejected'')', pg_temp.ws('vertuoza'), pg_temp.made('rival-one')),
      format('select public.product_add(%L, ''Planted'')', pg_temp.ws('vertuoza')),
      format('select public.product_rename(%L, %L, ''Planted'')', pg_temp.ws('vertuoza'), pg_temp.made('erp')),
      format('select public.repository_set_product(%L, ''vertuoza/vertuo-apps'', %L)', pg_temp.ws('vertuoza'), pg_temp.made('omni'))
    ] loop perform pg_temp.forbidden(c, who); end loop;
    if exists (select 1 from public.businesses) or exists (select 1 from public.products)
       or exists (select 1 from public.claims) or exists (select 1 from public.claim_citations) then
      raise exception 'FAIL: % reads Vertuoza''s business', who;
    end if;
  end loop;
  -- Carl: Vertuoza owns vertuo-apps, and he is not a member of it.
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000074c1');
  perform pg_temp.forbidden('select public.business_for_repo(''vertuoza/vertuo-apps'')', 'the member of another workspace');
  perform pg_temp.forbidden('select public.claims_cite(''vertuoza/vertuo-apps'', array[''rival#7''], ''think-big'', null)', 'the member of another workspace');
  -- Sam: in no workspace at all.
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000074d1');
  perform pg_temp.forbidden('select public.business_for_repo(''vertuoza/vertuo-apps'')', 'a stranger');
  perform pg_temp.forbidden('select public.claims_cite(''vertuoza/vertuo-apps'', array[''rival#7''], ''think-big'', null)', 'a stranger');
end $$;
reset role;

do $$
begin
  if pg_temp.store() <> (select s from before_outsiders) then
    raise exception 'FAIL: a refused call changed the store';
  end if;
end $$;

rollback;

\echo 'business: every check passed'
