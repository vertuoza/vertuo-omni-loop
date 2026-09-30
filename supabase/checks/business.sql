-- Who may read and write a workspace's business, and what agents read of it (PRD 748, PRD 774). The supabase
-- workflow runs it on every pull request, after `supabase db start` has applied the migrations and the
-- demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/business.sql
-- Any member of a workspace opens its business, picks, suggests, confirms and rejects claims, adds and
-- renames products, points a repository at a product, and cites claims, all through the functions of
-- 20261019090000_business_store.sql; a member of another workspace and anyone signed out are refused
-- (42501), and a bad kind or value is refused (22023). Opening the business points every repository
-- at its first product. business_for_repo() returns confirmed claims only: the region from the
-- business and the rest from the repository's product, the business's claims only when the repository
-- has none. Nobody writes the four tables directly, and nobody updates or deletes a citation. Nothing
-- is seeded.
--
-- PRD 774 (20261020090000_business_evidence.sql): a business holds three web pages at most; a draft runs
-- one at a time; evidence is merged as its decision 9 says (a receipt appends and moves last_seen, a
-- rejected value adds nothing, another confirmed offering or size is contradicted by a replacement);
-- That's us confirms the proposed evidence not marked ✗; a replacement's ✓ and ✗ settle both claims;
-- the count to check holds proposed evidence and faded claims; business_for_repo() returns confirmed
-- and contradicted claims with `state`. The service role runs a draft and proposes, and nothing else.
--
-- One transaction, rolled back at the end. Any `FAIL:` stops the run.

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
    (select string_agg(row(s.*)::text, ';' order by s.id) from public.business_sources s),
    (select string_agg(row(x.*)::text, ';' order by x.id) from public.claim_receipts x),
    (select string_agg(row(d.*)::text, ';' order by d.id) from public.business_drafts d),
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
    'select public.claims_cite(''vertuoza/vertuo-apps'', array[''rival#1''], ''think-big'', null)',
    format('select public.business_source_add(%L, ''https://vertuoza.com'')', pg_temp.ws('vertuoza')),
    format('select public.business_draft_start(%L, ''draft'')', pg_temp.ws('vertuoza')),
    format('select public.business_to_check(%L)', pg_temp.ws('vertuoza'))
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
  if (got->'claims'->0) <> '{"id": "region#1", "kind": "region", "value": "Belgium", "source": "pick", "state": "confirmed", "receipt": null, "lastSeen": null}'::jsonb then
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

-- ── PRD 774: web pages, three at most ──
do $$
declare
  s public.business_sources;
  c text;
begin
  s := public.business_source_add(pg_temp.ws('vertuoza'), ' https://vertuoza.com/pricing ');
  if s.url <> 'https://vertuoza.com/pricing' or s.added_by <> '00000000-0000-4000-8000-0000000074a1'::uuid then
    raise exception 'FAIL: a web page was not added as pasted, by whom: %', s;
  end if;
  insert into made values ('page-pricing', s.id);
  if (public.business_source_add(pg_temp.ws('vertuoza'), 'https://VERTUOZA.com/pricing')).id <> s.id then
    raise exception 'FAIL: the same web page added twice made a second one';
  end if;
  s := public.business_source_add(pg_temp.ws('vertuoza'), 'https://vertuoza.com');
  insert into made values ('page-home', s.id);
  perform public.business_source_add(pg_temp.ws('vertuoza'), 'https://vertuoza.com/about');
  foreach c in array array[
    format('select public.business_source_add(%L, ''https://vertuoza.com/fourth'')', pg_temp.ws('vertuoza')),
    format('select public.business_source_add(%L, ''http://vertuoza.com/plain'')', pg_temp.ws('vertuoza')),
    format('select public.business_source_add(%L, ''https:// spaced.test'')', pg_temp.ws('vertuoza')),
    format('select public.business_source_add(%L, ''vertuoza.com'')', pg_temp.ws('vertuoza')),
    format('select public.business_source_add(%L, null)', pg_temp.ws('vertuoza'))
  ] loop perform pg_temp.invalid(c); end loop;
  if (select count(*) from public.business_sources) <> 3 then
    raise exception 'FAIL: a fourth or a malformed web page was kept';
  end if;
  perform public.business_source_remove(pg_temp.ws('vertuoza'), pg_temp.made('page-home'));
  begin
    perform public.business_source_remove(pg_temp.ws('vertuoza'), pg_temp.made('page-home'));
    raise exception 'FAIL: a web page was removed twice';
  exception when no_data_found then null; end;
  perform public.business_source_add(pg_temp.ws('vertuoza'), 'https://vertuoza.com/fourth');
end $$;

-- ── PRD 774: one draft at a time ──
do $$
declare
  d public.business_drafts;
  again public.business_drafts;
begin
  d := public.business_draft_start(pg_temp.ws('vertuoza'), 'draft');
  if d.state <> 'running' or d.kind <> 'draft' or d.started_by <> '00000000-0000-4000-8000-0000000074a1'::uuid then
    raise exception 'FAIL: a draft did not start running, by whom: %', d;
  end if;
  again := public.business_draft_start(pg_temp.ws('vertuoza'), 'draft');
  if again.id <> d.id or (select count(*) from public.business_drafts) <> 1 then
    raise exception 'FAIL: a second click while a draft runs started another';
  end if;
  again := public.business_draft_progress(pg_temp.ws('vertuoza'), d.id, '{"readmes": 1}',
                                          '[{"label": "vertuo-apps · README.md", "read": true}]');
  if again.counts <> '{"readmes": 1}'::jsonb or jsonb_array_length(again.scanned) <> 1 then
    raise exception 'FAIL: a draft''s progress was not kept: %', again;
  end if;
  perform pg_temp.invalid(format('select public.business_draft_finish(%L, %L, ''failed'', null, null, null)', pg_temp.ws('vertuoza'), d.id));
  perform pg_temp.invalid(format('select public.business_draft_finish(%L, %L, ''running'')', pg_temp.ws('vertuoza'), d.id));
  perform pg_temp.invalid(format('select public.business_draft_progress(%L, %L, ''[]'', null)', pg_temp.ws('vertuoza'), d.id));
  perform pg_temp.invalid(format('select public.business_draft_start(%L, ''weekly'')', pg_temp.ws('vertuoza')));
  again := public.business_draft_finish(pg_temp.ws('vertuoza'), d.id, 'done', '{"readmes": 2, "prds": 14, "pages": 1}');
  if again.state <> 'done' or again.finished_at is null or again.counts->>'prds' <> '14' or again.reason is not null then
    raise exception 'FAIL: a finished draft does not read as done with its counts: %', again;
  end if;
  begin
    perform public.business_draft_finish(pg_temp.ws('vertuoza'), d.id, 'done');
    raise exception 'FAIL: a finished draft was finished again';
  exception when no_data_found then null; end;
  d := public.business_draft_start(pg_temp.ws('vertuoza'), 'draft');
  if d.id = again.id then raise exception 'FAIL: a draft after a finished one did not start anew'; end if;
  d := public.business_draft_finish(pg_temp.ws('vertuoza'), d.id, 'failed', null, null, 'The model key is unset.');
  if d.state <> 'failed' or d.reason <> 'The model key is unset.' then
    raise exception 'FAIL: a failed draft does not say why: %', d;
  end if;
end $$;
reset role;

-- A draft whose function died stops blocking the next one after 15 minutes.
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000074a1');
do $$
declare d public.business_drafts;
begin
  d := public.business_draft_start(pg_temp.ws('vertuoza'), 'draft');
  insert into made values ('stuck-draft', d.id);
end $$;
reset role;
update public.business_drafts set started_at = now() - interval '16 minutes' where id = pg_temp.made('stuck-draft');
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000074a1');
do $$
declare d public.business_drafts;
begin
  d := public.business_draft_start(pg_temp.ws('vertuoza'), 'draft');
  if d.id = pg_temp.made('stuck-draft') or d.state <> 'running' then
    raise exception 'FAIL: a draft stuck for 16 minutes still blocks the next one';
  end if;
  if (select state from public.business_drafts where id = pg_temp.made('stuck-draft')) <> 'failed' then
    raise exception 'FAIL: the stuck draft was not marked failed';
  end if;
  perform public.business_draft_finish(pg_temp.ws('vertuoza'), d.id, 'done');
end $$;

-- ── PRD 774: evidence, merged as decision 9 says ──
do $$
declare
  got jsonb;
  n integer;
  c text;
  luxe constant text := '[{"kind": "file", "where": "vertuoza/vertuo-apps:README.md", "quote": "Built for Luxembourg builders"}]';
begin
  -- Nothing held for that value: a proposed evidence claim, with its receipt.
  got := public.claim_propose_evidence(pg_temp.ws('vertuoza'), null, 'region', 'Luxembourg', luxe::jsonb);
  if got <> '{"outcome": "added", "id": "region#11"}'::jsonb then raise exception 'FAIL: a new region was not added: %', got; end if;
  if not exists (select 1 from public.claims where kind = 'region' and seq = 11 and source = 'evidence' and state = 'proposed'
                   and receipt is null and last_seen is not null)
     or (select count(*) from public.claim_receipts x join public.claims c on c.id = x.claim_id where c.seq = 11) <> 1 then
    raise exception 'FAIL: an evidence claim is not proposed with one receipt and last_seen';
  end if;
  insert into made select 'luxembourg', id from public.claims where seq = 11;

  -- The value proposed already: its receipt is added, no second claim.
  got := public.claim_propose_evidence(pg_temp.ws('vertuoza'), null, 'region', 'luxembourg',
           '[{"kind": "link", "where": "https://vertuoza.com/pricing", "quote": "Luxembourg"}]');
  if got <> '{"outcome": "seen", "id": "region#11"}'::jsonb
     or (select count(*) from public.claim_receipts where claim_id = pg_temp.made('luxembourg')) <> 2 then
    raise exception 'FAIL: a proposed value quoted again did not gain a receipt: %', got;
  end if;

  -- A rejected value is never proposed again: nothing changes.
  n := (select count(*) from public.claims);
  got := public.claim_propose_evidence(pg_temp.ws('vertuoza'), pg_temp.made('erp'), 'rival', 'rival three',
           '[{"kind": "file", "where": "vertuoza/vertuo-apps:docs/market.md", "quote": "Rival Three"}]');
  if got <> '{"outcome": "rejected", "id": null}'::jsonb or (select count(*) from public.claims) <> n
     or exists (select 1 from public.claim_receipts where claim_id = pg_temp.made('rival-three'))
     or (select state from public.claims where id = pg_temp.made('rival-three')) <> 'rejected' then
    raise exception 'FAIL: evidence of a rejected value changed the store: %', got;
  end if;

  -- The value confirmed: a receipt, and nothing shown as new.
  got := public.claim_propose_evidence(pg_temp.ws('vertuoza'), null, 'region', 'Belgium',
           '[{"kind": "file", "where": "vertuoza/vertuo-apps:README.md", "quote": "our Belgian customers"}]');
  if got <> '{"outcome": "seen", "id": "region#1"}'::jsonb
     or (select state from public.claims where kind = 'region' and seq = 1) <> 'confirmed' then
    raise exception 'FAIL: evidence of a confirmed value: %', got;
  end if;

  -- Bad candidates: 22023, nothing stored.
  foreach c in array array[
    format('select public.claim_propose_evidence(%L, null, ''region'', ''France'', ''[]'')', pg_temp.ws('vertuoza')),
    format('select public.claim_propose_evidence(%L, null, ''region'', ''France'', null)', pg_temp.ws('vertuoza')),
    format('select public.claim_propose_evidence(%L, null, ''region'', ''France'', ''[{"kind": "deck", "where": "x", "quote": "France"}]'')', pg_temp.ws('vertuoza')),
    format('select public.claim_propose_evidence(%L, null, ''region'', ''France'', ''[{"kind": "file", "where": "", "quote": "France"}]'')', pg_temp.ws('vertuoza')),
    format('select public.claim_propose_evidence(%L, null, ''region'', ''France'', %L)', pg_temp.ws('vertuoza'),
           jsonb_build_array(jsonb_build_object('kind', 'file', 'where', 'README.md', 'quote', repeat('q', 301)))),
    format('select public.claim_propose_evidence(%L, null, ''buyer'', ''CFO'', %L)', pg_temp.ws('vertuoza'), luxe),
    format('select public.claim_propose_evidence(%L, %L, ''size'', ''3-40'', %L)', pg_temp.ws('vertuoza'), pg_temp.made('erp'), luxe),
    format('select public.claim_propose_evidence(%L, null, ''trade'', ''roofing'', %L)', pg_temp.ws('vertuoza'), luxe)
  ] loop perform pg_temp.invalid(c); end loop;
end $$;
reset role;

-- A receipt quoted again moves its seen_at, and the claim's last_seen with it.
update public.claim_receipts set seen_at = '2026-01-05' where claim_id = pg_temp.made('luxembourg');
update public.claims set last_seen = '2026-01-05' where id = pg_temp.made('luxembourg');
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000074a1');
do $$
declare got jsonb;
begin
  got := public.claim_propose_evidence(pg_temp.ws('vertuoza'), null, 'region', 'Luxembourg',
           '[{"kind": "file", "where": "vertuoza/vertuo-apps:README.md", "quote": "Built for Luxembourg builders"}]');
  if (select count(*) from public.claim_receipts where claim_id = pg_temp.made('luxembourg')) <> 2
     or (select max(seen_at) from public.claim_receipts where claim_id = pg_temp.made('luxembourg')) <> now()
     or (select last_seen from public.claims where id = pg_temp.made('luxembourg')) <> now() then
    raise exception 'FAIL: a receipt quoted again did not move seen_at and last_seen';
  end if;
end $$;

-- ── PRD 774: replacements ──
do $$
declare
  got jsonb;
  c public.claims;
  crm uuid;
  suite uuid;
begin
  -- Another confirmed offering: a proposed replacement, and ERP contradicted.
  got := public.claim_propose_evidence(pg_temp.ws('vertuoza'), pg_temp.made('erp'), 'offering', 'CRM',
           '[{"kind": "link", "where": "https://vertuoza.com/pricing", "quote": "the CRM for builders"}]');
  if got->>'outcome' <> 'replacing' then raise exception 'FAIL: a new offering is not a replacement: %', got; end if;
  select id into crm from public.claims where kind = 'offering' and value = 'CRM';
  if (select replaces from public.claims where id = crm) is distinct from (select id from public.claims where kind = 'offering' and seq = 3)
     or (select state from public.claims where kind = 'offering' and seq = 3) <> 'contradicted' then
    raise exception 'FAIL: the replacement does not name ERP, or ERP is not contradicted';
  end if;
  -- What agents read meanwhile: ERP marked contradicted, CRM (proposed) not at all.
  got := public.business_for_repo('vertuoza/vertuo-apps');
  if not exists (select 1 from jsonb_array_elements(got->'claims') x where x->>'id' = 'offering#3' and x->>'state' = 'contradicted')
     or got::text like '%CRM%' then
    raise exception 'FAIL: agents do not read ERP as contradicted, or read CRM: %', got->'claims';
  end if;

  -- ✓ Right: CRM confirmed, ERP rejected.
  c := public.claim_settle_replacement(pg_temp.ws('vertuoza'), crm, true);
  if c.state <> 'confirmed' or (select state from public.claims where kind = 'offering' and seq = 3) <> 'rejected' then
    raise exception 'FAIL: ✓ on a replacement did not confirm it and reject the old one';
  end if;
  begin
    perform public.claim_settle_replacement(pg_temp.ws('vertuoza'), crm, true);
    raise exception 'FAIL: a settled replacement was settled again';
  exception when no_data_found then null; end;

  -- ✗ Wrong (through claim_set_state): the new one rejected, CRM confirmed again.
  got := public.claim_propose_evidence(pg_temp.ws('vertuoza'), pg_temp.made('erp'), 'offering', 'Suite',
           '[{"kind": "file", "where": "vertuoza/vertuo-apps:docs/product.md", "quote": "the Suite"}]');
  select id into suite from public.claims where kind = 'offering' and value = 'Suite';
  if (select state from public.claims where id = crm) <> 'contradicted' then raise exception 'FAIL: CRM not contradicted by Suite'; end if;
  c := public.claim_set_state(pg_temp.ws('vertuoza'), suite, 'rejected');
  if c.state <> 'rejected' or (select state from public.claims where id = crm) <> 'confirmed' then
    raise exception 'FAIL: ✗ on a replacement did not reject it and confirm the old one again';
  end if;
  -- ERP, rejected, is never proposed again.
  got := public.claim_propose_evidence(pg_temp.ws('vertuoza'), pg_temp.made('erp'), 'offering', 'ERP',
           '[{"kind": "file", "where": "vertuoza/vertuo-apps:README.md", "quote": "ERP"}]');
  if got->>'outcome' <> 'rejected' or (select state from public.claims where id = crm) <> 'confirmed' then
    raise exception 'FAIL: a rejected offering came back: %', got;
  end if;
  -- A size, snapped by the draft, contradicts the first confirmed size; left waiting below.
  got := public.claim_propose_evidence(pg_temp.ws('vertuoza'), pg_temp.made('erp'), 'size', '5-10',
           '[{"kind": "file", "where": "vertuoza/vertuo-apps:README.md", "quote": "teams of 5 to 10"}]');
  if got->>'outcome' <> 'replacing' or (select state from public.claims where kind = 'size' and seq = 4) <> 'contradicted' then
    raise exception 'FAIL: a new size did not contradict the first confirmed one: %', got;
  end if;
  insert into made select 'size-5-10', id from public.claims where kind = 'size' and value = '5-10';
end $$;

-- ── PRD 774: That's us ──
do $$
declare
  n integer;
  roofing uuid;
begin
  perform public.claim_propose_evidence(pg_temp.ws('vertuoza'), pg_temp.made('erp'), 'trade', 'renovation',
            '[{"kind": "file", "where": "vertuoza/vertuo-apps:README.md", "quote": "renovation companies"}]');
  perform public.claim_propose_evidence(pg_temp.ws('vertuoza'), pg_temp.made('erp'), 'trade', 'roofing',
            '[{"kind": "file", "where": "vertuoza/vertuo-apps:README.md", "quote": "roofing"}]');
  select id into roofing from public.claims where kind = 'trade' and value = 'roofing';
  n := public.claims_confirm_proposed(pg_temp.ws('vertuoza'), array[roofing]);
  if n <> 2 or (select state from public.claims where kind = 'trade' and value = 'renovation') <> 'confirmed'
     or (select state from public.claims where id = pg_temp.made('luxembourg')) <> 'confirmed'
     or (select state from public.claims where id = roofing) <> 'rejected' then
    raise exception 'FAIL: That''s us did not confirm the rows left alone and reject the one marked ✗ (%)', n;
  end if;
  -- Nor does it touch a replacement, which waits for its own ✓ or ✗.
  if (select state from public.claims where id = pg_temp.made('size-5-10')) <> 'proposed'
     or (select state from public.claims where kind = 'size' and seq = 4) <> 'contradicted' then
    raise exception 'FAIL: That''s us settled a replacement';
  end if;
end $$;

-- ── PRD 774: what agents read, and what waits to be checked ──
do $$
declare got jsonb;
begin
  got := public.business_for_repo('vertuoza/vertuo-apps');
  if exists (select 1 from jsonb_array_elements(got->'claims') x
              where x->>'state' not in ('confirmed', 'contradicted')
                 or x->>'value' in ('Suite', 'roofing', '5-10', 'ERP', 'Rival Three')) then
    raise exception 'FAIL: agents read a proposed or rejected claim: %', got->'claims';
  end if;
  if not exists (select 1 from jsonb_array_elements(got->'claims') x
                  where x->>'id' = 'size#4' and x->>'state' = 'contradicted') then
    raise exception 'FAIL: agents do not read the contradicted size: %', got->'claims';
  end if;
  -- `receipt` is the newest receipt; a pick keeps none.
  if (select x->>'receipt' from jsonb_array_elements(got->'claims') x where x->>'id' = 'region#1')
       <> 'vertuoza/vertuo-apps:README.md — "our Belgian customers"'
     or (select x->'receipt' from jsonb_array_elements(got->'claims') x where x->>'id' = 'region#2') <> 'null'::jsonb then
    raise exception 'FAIL: receipt is not the newest receipt, or a pick gained one: %', got->'claims';
  end if;
  -- The replacement waiting: one thing to check.
  if public.business_to_check(pg_temp.ws('vertuoza')) <> 1 then
    raise exception 'FAIL: the count to check is not the one replacement: %', public.business_to_check(pg_temp.ws('vertuoza'));
  end if;
end $$;
reset role;

-- A confirmed claim with receipts unquoted for eight weeks fades; one without receipts never does.
update public.claim_receipts set seen_at = now() - interval '9 weeks'
 where claim_id = (select id from public.claims where kind = 'region' and seq = 1);
update public.claims set last_seen = now() - interval '9 weeks' where kind = 'region' and seq in (1, 2);
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000074b1');
do $$
declare c public.claims;
begin
  if public.business_to_check(pg_temp.ws('vertuoza')) <> 2 then
    raise exception 'FAIL: a faded claim is not counted, or a claim without receipts faded: %', public.business_to_check(pg_temp.ws('vertuoza'));
  end if;
  c := public.claim_still_true(pg_temp.ws('vertuoza'), (select id from public.claims where kind = 'region' and seq = 1));
  if c.last_seen <> now() or public.business_to_check(pg_temp.ws('vertuoza')) <> 1 then
    raise exception 'FAIL: ✓ Still true did not clear the faded claim';
  end if;
  begin
    perform public.claim_still_true(pg_temp.ws('vertuoza'), pg_temp.made('size-5-10'));
    raise exception 'FAIL: ✓ Still true took a proposed claim';
  exception when no_data_found then null; end;
end $$;
reset role;

-- ── PRD 774: the service role runs a draft and proposes, and presses nothing ──
set local role service_role;
select set_config('request.jwt.claims', '{"role": "service_role"}', true);
do $$
declare
  d public.business_drafts;
  got jsonb;
  c text;
begin
  d := public.business_draft_start(pg_temp.ws('vertuoza'), 'recheck');
  if d.kind <> 'recheck' or d.started_by is not null then raise exception 'FAIL: the recheck did not start as nobody: %', d; end if;
  got := public.claim_propose_evidence(pg_temp.ws('vertuoza'), null, 'region', 'France',
           '[{"kind": "link", "where": "https://vertuoza.com/about", "quote": "offices in France"}]');
  if got->>'outcome' <> 'seen' then raise exception 'FAIL: the recheck could not propose: %', got; end if;
  perform public.business_draft_finish(pg_temp.ws('vertuoza'), d.id, 'done');
  foreach c in array array[
    format('select public.claims_confirm_proposed(%L, ''{}'')', pg_temp.ws('vertuoza')),
    format('select public.business_source_add(%L, ''https://planted.test'')', pg_temp.ws('vertuoza')),
    format('select public.claim_settle_replacement(%L, %L, true)', pg_temp.ws('vertuoza'), pg_temp.made('size-5-10'))
  ] loop perform pg_temp.forbidden(c, 'the service role'); end loop;
end $$;
reset role;

set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000074a1');

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
    'update public.repositories set product_id = null',
    format('insert into public.business_sources (workspace_id, business_id, url) select %L, id, ''https://x.test'' from public.businesses', pg_temp.ws('vertuoza')),
    'delete from public.business_sources',
    'update public.claim_receipts set quote = ''x''',
    'delete from public.claim_receipts',
    'update public.business_drafts set state = ''done''',
    'delete from public.business_drafts',
    'update public.claims set replaces = null'
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
      format('select public.repository_set_product(%L, ''vertuoza/vertuo-apps'', %L)', pg_temp.ws('vertuoza'), pg_temp.made('omni')),
      format('select public.business_source_add(%L, ''https://planted.test'')', pg_temp.ws('vertuoza')),
      format('select public.business_source_remove(%L, %L)', pg_temp.ws('vertuoza'), pg_temp.made('page-pricing')),
      format('select public.business_draft_start(%L, ''draft'')', pg_temp.ws('vertuoza')),
      format('select public.claim_propose_evidence(%L, %L, ''rival'', ''Planted'', ''[{"kind": "file", "where": "README.md", "quote": "Planted"}]'')', pg_temp.ws('vertuoza'), pg_temp.made('erp')),
      format('select public.claims_confirm_proposed(%L, ''{}'')', pg_temp.ws('vertuoza')),
      format('select public.claim_settle_replacement(%L, %L, true)', pg_temp.ws('vertuoza'), pg_temp.made('size-5-10')),
      format('select public.claim_still_true(%L, %L)', pg_temp.ws('vertuoza'), pg_temp.made('rival-one')),
      format('select public.business_to_check(%L)', pg_temp.ws('vertuoza'))
    ] loop perform pg_temp.forbidden(c, who); end loop;
    if exists (select 1 from public.businesses) or exists (select 1 from public.products)
       or exists (select 1 from public.claims) or exists (select 1 from public.claim_citations)
       or exists (select 1 from public.business_sources) or exists (select 1 from public.claim_receipts)
       or exists (select 1 from public.business_drafts) then
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
