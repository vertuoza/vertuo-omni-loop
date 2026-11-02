-- Who may read and change a product's domains (PRD 2583 s1, 20270107090000_product_domains.sql). The
-- supabase workflow runs it on every pull request, after `supabase db start` has applied the migrations
-- and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/product_domains.sql
-- The spec's "Who decides": a workspace owner names the Domains owner and delegate; they add, edit and
-- retire domains and approve or reject proposals; while the kind names neither, the workspace's owners
-- act as its owner; any other member proposes, and a proposed domain is off the list until it is
-- approved; anyone outside the workspace, or signed out, reads nothing and writes nothing. A key is
-- lower-case words joined by hyphens, at most 60 characters; one the product has, or retired, is refused,
-- naming `key`; a key never changes. A retired domain keeps its row. Every change appends exactly one
-- event, in the same transaction; nobody writes the table directly, the service role included. An
-- author's deleted account leaves the domain and its history, naming nobody (L-GDPR-3).
--
-- PRD 2583 s2, a term's domains: a glossary term names none, one or several domains of its own product, by
-- key; none is a cross-domain term and records no field. A key the product lacks, a retired one, an invalid
-- one and another product's are refused naming `domains`, and no link to another product's domain can exist
-- even past the functions; a link made before its domain was retired stays and a new one is refused; a
-- member who only proposes proposes the same; the links are the members' to read and nobody's to write.
--
-- PRD 2583 s3, the folders off the list: the pages read each repository's newest pack as the person; a member
-- reads the folders of their product's repositories and plan repository, a member of another workspace and a
-- stranger read no repository, pack or folder name, and anon reads no pack.
--
-- One transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

-- ── Nothing seeded ──
do $$
begin
  if exists (select 1 from public.product_domains) then
    raise exception 'FAIL: a domain exists before anyone wrote one';
  end if;
end $$;

-- ── The cast ──
-- PD (github_org pd-org): Olga owns it; Dina, Del and Max are members. Dina will own the Domains and Del
-- stand in for her; Max only ever proposes. Carl owns Other; Sam belongs to no workspace. PD sells Stock
-- and Payroll; Other sells Widgets.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000002583a1', 'olga@pd.test'),
  ('00000000-0000-4000-8000-0000002583a2', 'dina@pd.test'),
  ('00000000-0000-4000-8000-0000002583a3', 'del@pd.test'),
  ('00000000-0000-4000-8000-0000002583a4', 'max@pd.test'),
  ('00000000-0000-4000-8000-0000002583c1', 'carl@pd-other.test'),
  ('00000000-0000-4000-8000-0000002583d1', 'sam@nowhere.test');
insert into public.workspaces (id, slug, name, github_org) values
  ('00000000-0000-4000-8000-000000258300', 'pd', 'PD', 'pd-org'),
  ('00000000-0000-4000-8000-000000258301', 'pd-other', 'Other', 'pd-other');
insert into public.workspace_members (workspace_id, user_id, role) values
  ('00000000-0000-4000-8000-000000258300', '00000000-0000-4000-8000-0000002583a1', 'owner'),
  ('00000000-0000-4000-8000-000000258300', '00000000-0000-4000-8000-0000002583a2', 'member'),
  ('00000000-0000-4000-8000-000000258300', '00000000-0000-4000-8000-0000002583a3', 'member'),
  ('00000000-0000-4000-8000-000000258300', '00000000-0000-4000-8000-0000002583a4', 'member'),
  ('00000000-0000-4000-8000-000000258301', '00000000-0000-4000-8000-0000002583c1', 'owner');
insert into public.businesses (id, workspace_id, name) values
  ('00000000-0000-4000-8000-0000002583b0', '00000000-0000-4000-8000-000000258300', 'PD'),
  ('00000000-0000-4000-8000-0000002583b1', '00000000-0000-4000-8000-000000258301', 'Other');
insert into public.products (id, workspace_id, business_id, name) values
  ('00000000-0000-4000-8000-0000002583e1', '00000000-0000-4000-8000-000000258300', '00000000-0000-4000-8000-0000002583b0', 'Stock'),
  ('00000000-0000-4000-8000-0000002583e2', '00000000-0000-4000-8000-000000258300', '00000000-0000-4000-8000-0000002583b0', 'Payroll'),
  ('00000000-0000-4000-8000-0000002583e3', '00000000-0000-4000-8000-000000258301', '00000000-0000-4000-8000-0000002583b1', 'Widgets');

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create temporary table who (name text primary key, id uuid);
insert into who values
  ('olga', '00000000-0000-4000-8000-0000002583a1'), ('dina', '00000000-0000-4000-8000-0000002583a2'),
  ('del', '00000000-0000-4000-8000-0000002583a3'), ('max', '00000000-0000-4000-8000-0000002583a4'),
  ('carl', '00000000-0000-4000-8000-0000002583c1'), ('sam', '00000000-0000-4000-8000-0000002583d1'),
  ('pd', '00000000-0000-4000-8000-000000258300'), ('other', '00000000-0000-4000-8000-000000258301'),
  ('stock', '00000000-0000-4000-8000-0000002583e1'), ('payroll', '00000000-0000-4000-8000-0000002583e2'),
  ('widgets', '00000000-0000-4000-8000-0000002583e3');
grant select on who to anon, authenticated, service_role;
create function pg_temp.id(name text) returns uuid language sql as $$
  select w.id from who w where w.name = id.name;
$$;
create function pg_temp.as_(name text) returns void language sql as $$
  select pg_temp.sign_in(pg_temp.id(name)::text);
$$;
create temporary table made (name text primary key, id uuid);
grant select, insert, update on made to anon, authenticated, service_role;
create function pg_temp.made(name text) returns uuid language sql as $$
  select m.id from made m where m.name = made.name;
$$;
-- Runs a call that must be refused with `state` (and, for 22023, the field `hint` names).
create function pg_temp.refused(stmt text, state text, field text default null) returns void language plpgsql as $$
declare
  got text;
  said text;
begin
  begin
    execute stmt;
  exception when others then
    get stacked diagnostics got = returned_sqlstate, said = pg_exception_hint;
  end;
  if got is distinct from state then
    raise exception 'FAIL: % answered % (want %)', stmt, coalesce(got, 'success'), state;
  end if;
  if field is not null and said is distinct from field then
    raise exception 'FAIL: % named % in its hint (want %)', stmt, coalesce(nullif(said, ''), 'nothing'), field;
  end if;
end;
$$;
-- Everything the domains and their history hold, as one value to compare before and after refusals.
create function pg_temp.store() returns text language sql security definer as $$
  select concat_ws('|',
    (select string_agg(row(d.*)::text, ';' order by d.id) from public.product_domains d),
    (select string_agg(row(o.*)::text, ';' order by o.product_id, o.kind, o.role) from public.product_knowledge_owners o),
    (select string_agg(row(p.*)::text, ';' order by p.id) from public.product_knowledge_proposals p),
    (select string_agg(row(e.*)::text, ';' order by e.id) from public.product_knowledge_events e));
$$;
create function pg_temp.events() returns bigint language sql security definer as $$
  select count(*) from public.product_knowledge_events;
$$;
create function pg_temp.newest() returns public.product_knowledge_events language sql security definer as $$
  select * from public.product_knowledge_events e order by e.id desc limit 1;
$$;
-- Fails unless exactly one event of the Domains kind was appended since `was` events, with `action`.
create function pg_temp.one_event(was bigint, action text) returns public.product_knowledge_events
language plpgsql security definer as $$
declare e public.product_knowledge_events := pg_temp.newest();
begin
  if pg_temp.events() <> was + 1 or e.action <> action or e.kind <> 'domains' then
    raise exception 'FAIL: want exactly one % event of domains, got % new, the newest %', action, pg_temp.events() - was, e;
  end if;
  return e;
end;
$$;
create function pg_temp.domain(entry uuid) returns public.product_domains language sql security definer as $$
  select * from public.product_domains d where d.id = entry;
$$;
create function pg_temp.listed(product uuid) returns text language sql security definer as $$
  select coalesce(string_agg(d.key, ',' order by d.key), '') from public.product_domains d where d.product_id = product and d.retired_at is null;
$$;

-- ── Signed out: no function runs, nothing is read ──
set local role anon;
do $$
declare c text;
begin
  foreach c in array array[
    format('select public.product_domain_add(%L, %L, ''planted'', ''Planted'', ''Planted'')', pg_temp.id('pd'), pg_temp.id('stock')),
    format('select public.product_domain_edit(%L, gen_random_uuid(), ''Planted'')', pg_temp.id('pd')),
    format('select public.product_domain_retire(%L, gen_random_uuid())', pg_temp.id('pd')),
    format('select public.product_knowledge_propose(%L, %L, ''domains'', ''add'', null, ''{"key": "planted", "name": "P", "meaning": "P"}'')', pg_temp.id('pd'), pg_temp.id('stock')),
    format('select public.product_knowledge_name(%L, %L, ''domains'', ''owner'', %L)', pg_temp.id('pd'), pg_temp.id('stock'), pg_temp.id('dina')),
    'select * from public.product_domains'
  ] loop perform pg_temp.refused(c, '42501'); end loop;
end $$;
reset role;

-- ── While Domains names nobody, the workspace's owners decide; any other member proposes ──
set local role authenticated;
do $$
declare
  n bigint;
  d public.product_domains;
  e public.product_knowledge_events;
  p public.product_knowledge_proposals;
begin
  -- Max, a plain member, may only propose: his domain is off the list until it is approved.
  perform pg_temp.as_('max');
  perform pg_temp.refused(format('select public.product_domain_add(%L, %L, ''planted'', ''Planted'', ''Planted'')', pg_temp.id('pd'), pg_temp.id('stock')), '42501');
  n := pg_temp.events();
  p := public.product_knowledge_propose(pg_temp.id('pd'), pg_temp.id('stock'), 'domains', 'add', null,
         '{"key": "planning", "name": "Planning", "meaning": "Who works where, and when."}');
  e := pg_temp.one_event(n, 'proposed');
  if p.state <> 'open' or p.kind <> 'domains' or p.action <> 'add' or p.proposed_by <> pg_temp.id('max') or p.domain_id is not null
     or e.proposal_id <> p.id or e.before is not null or e.domain_id is not null
     or e.after <> jsonb_build_object('key', 'planning', 'name', 'Planning', 'meaning', 'Who works where, and when.') then
    raise exception 'FAIL: a member''s proposed domain: % %', p, e;
  end if;
  insert into made values ('planning-proposal', p.id);
  p := public.product_knowledge_propose(pg_temp.id('pd'), pg_temp.id('stock'), 'domains', 'add', null,
         '{"key": "shipping", "name": "Shipping", "meaning": "Parcels leaving the warehouse."}');
  insert into made values ('shipping-proposal', p.id);
  if pg_temp.listed(pg_temp.id('stock')) <> '' then raise exception 'FAIL: a proposed domain is listed before anyone approved it'; end if;
  perform pg_temp.refused(format('select public.product_knowledge_approve(%L, %L)', pg_temp.id('pd'), pg_temp.made('planning-proposal')), '42501');

  -- Olga, an owner of the workspace, adds directly: listed, with one `added` event naming it.
  perform pg_temp.as_('olga');
  n := pg_temp.events();
  d := public.product_domain_add(pg_temp.id('pd'), pg_temp.id('stock'), ' invoicing ', '  Invoicing ', 'Billing a customer for what they bought.');
  e := pg_temp.one_event(n, 'added');
  if d.key <> 'invoicing' or d.name <> 'Invoicing' or d.meaning <> 'Billing a customer for what they bought.'
     or d.created_by <> pg_temp.id('olga') or d.retired_at is not null or e.domain_id <> d.id or e.legal_id is not null
     or e.glossary_id is not null or e.before is not null or e.changed_by <> pg_temp.id('olga')
     or e.after <> jsonb_build_object('key', 'invoicing', 'name', 'Invoicing', 'meaning', d.meaning) then
    raise exception 'FAIL: the owner adding invoicing: % %', d, e;
  end if;
  insert into made values ('invoicing', d.id);

  -- She approves Planning (now listed) and rejects Shipping (still off the list), one event each.
  n := pg_temp.events();
  p := public.product_knowledge_approve(pg_temp.id('pd'), pg_temp.made('planning-proposal'));
  e := pg_temp.one_event(n, 'approved');
  d := pg_temp.domain(p.domain_id);
  if p.state <> 'approved' or p.decided_by <> pg_temp.id('olga') or d.key <> 'planning' or d.created_by <> pg_temp.id('olga')
     or e.domain_id <> d.id or e.proposal_id <> p.id or e.after->>'key' <> 'planning' then
    raise exception 'FAIL: approving Max''s planning: % % %', p, d, e;
  end if;
  insert into made values ('planning', d.id);
  n := pg_temp.events();
  p := public.product_knowledge_reject(pg_temp.id('pd'), pg_temp.made('shipping-proposal'));
  e := pg_temp.one_event(n, 'rejected');
  if p.state <> 'rejected' or p.domain_id is not null or e.proposal_id <> p.id then
    raise exception 'FAIL: rejecting shipping: % %', p, e;
  end if;
  if pg_temp.listed(pg_temp.id('stock')) <> 'invoicing,planning' then
    raise exception 'FAIL: the list after an approval and a rejection: %', pg_temp.listed(pg_temp.id('stock'));
  end if;
  perform pg_temp.refused(format('select public.product_knowledge_approve(%L, %L)', pg_temp.id('pd'), pg_temp.made('shipping-proposal')), 'P0002', 'proposal');
end $$;
reset role;

-- ── A workspace owner names the Domains owner and delegate; then only they decide ──
set local role authenticated;
do $$
declare
  n bigint;
  e public.product_knowledge_events;
  got jsonb;
  stmt text;
begin
  perform pg_temp.as_('dina');
  perform pg_temp.refused(format('select public.product_knowledge_name(%L, %L, ''domains'', ''owner'', %L)', pg_temp.id('pd'), pg_temp.id('stock'), pg_temp.id('dina')), '42501');
  perform pg_temp.as_('olga');
  n := pg_temp.events();
  got := public.product_knowledge_name(pg_temp.id('pd'), pg_temp.id('stock'), 'domains', 'owner', pg_temp.id('dina'));
  e := pg_temp.one_event(n, 'named');
  if got->>'kind' <> 'domains' or e.after <> jsonb_build_object('role', 'owner', 'user', pg_temp.id('dina')) or e.domain_id is not null then
    raise exception 'FAIL: naming Dina the Domains owner: % %', got, e;
  end if;
  perform public.product_knowledge_name(pg_temp.id('pd'), pg_temp.id('stock'), 'domains', 'delegate', pg_temp.id('del'));

  -- Olga no longer decides the Domains of Stock, nor does Max; Payroll still names nobody, so she does there.
  foreach stmt in array array['olga', 'max'] loop
    perform pg_temp.as_(stmt);
    perform pg_temp.refused(format('select public.product_domain_add(%L, %L, ''planted'', ''P'', ''P'')', pg_temp.id('pd'), pg_temp.id('stock')), '42501');
    perform pg_temp.refused(format('select public.product_domain_edit(%L, %L, ''Planted'')', pg_temp.id('pd'), pg_temp.made('invoicing')), '42501');
    perform pg_temp.refused(format('select public.product_domain_retire(%L, %L)', pg_temp.id('pd'), pg_temp.made('invoicing')), '42501');
  end loop;
  perform pg_temp.as_('olga');
  perform public.product_domain_add(pg_temp.id('pd'), pg_temp.id('payroll'), 'invoicing', 'Invoicing', 'The same key in another product is that product''s own.');
end $$;
reset role;

-- ── Keys: valid, never taken twice, never changed ──
set local role authenticated;
do $$
declare
  stmt text;
begin
  perform pg_temp.as_('dina');
  foreach stmt in array array[
    format('select public.product_domain_add(%L, %L, ''invoicing'', ''Again'', ''Again'')', pg_temp.id('pd'), pg_temp.id('stock')),
    format('select public.product_domain_add(%L, %L, ''Invoicing'', ''A'', ''B'')', pg_temp.id('pd'), pg_temp.id('stock')),
    format('select public.product_domain_add(%L, %L, ''1nvoicing'', ''A'', ''B'')', pg_temp.id('pd'), pg_temp.id('stock')),
    format('select public.product_domain_add(%L, %L, ''-invoicing'', ''A'', ''B'')', pg_temp.id('pd'), pg_temp.id('stock')),
    format('select public.product_domain_add(%L, %L, ''old_stock'', ''A'', ''B'')', pg_temp.id('pd'), pg_temp.id('stock')),
    format('select public.product_domain_add(%L, %L, ''old stock'', ''A'', ''B'')', pg_temp.id('pd'), pg_temp.id('stock')),
    format('select public.product_domain_add(%L, %L, %L, ''A'', ''B'')', pg_temp.id('pd'), pg_temp.id('stock'), repeat('x', 61)),
    format('select public.product_domain_add(%L, %L, null, ''A'', ''B'')', pg_temp.id('pd'), pg_temp.id('stock')),
    format('select public.product_knowledge_propose(%L, %L, ''domains'', ''add'', null, ''{"key": 7, "name": "A", "meaning": "B"}'')', pg_temp.id('pd'), pg_temp.id('stock'))
  ] loop perform pg_temp.refused(stmt, '22023', 'key'); end loop;
  perform public.product_domain_add(pg_temp.id('pd'), pg_temp.id('stock'), repeat('x', 60), 'Sixty', 'A key of sixty characters is a key.');
  perform pg_temp.refused(format('select public.product_domain_add(%L, %L, ''stock'', %L, ''B'')', pg_temp.id('pd'), pg_temp.id('stock'), repeat('n', 81)), '22023', 'name');
  perform pg_temp.refused(format('select public.product_domain_add(%L, %L, ''stock'', ''A'', %L)', pg_temp.id('pd'), pg_temp.id('stock'), repeat('m', 401)), '22023', 'meaning');
  perform pg_temp.refused(format('select public.product_domain_add(%L, %L, ''stock'', ''A'', %L)', pg_temp.id('pd'), pg_temp.id('stock'), E'two\nlines'), '22023', 'meaning');
  perform pg_temp.refused(format('select public.product_domain_add(%L, %L, ''stock'', ''  '', ''B'')', pg_temp.id('pd'), pg_temp.id('stock')), '22023', 'name');
  perform pg_temp.refused(format('select public.product_domain_edit(%L, %L)', pg_temp.id('pd'), pg_temp.made('invoicing')), '22023', 'fields');
  -- A member's proposal is checked the same, and a key is never a field of an edit.
  perform pg_temp.as_('max');
  perform pg_temp.refused(format('select public.product_knowledge_propose(%L, %L, ''domains'', ''add'', null, ''{"key": "invoicing", "name": "A", "meaning": "B"}'')', pg_temp.id('pd'), pg_temp.id('stock')), '22023', 'key');
  perform pg_temp.refused(format('select public.product_knowledge_propose(%L, %L, ''domains'', ''edit'', %L, ''{"key": "billing"}'')', pg_temp.id('pd'), pg_temp.id('stock'), pg_temp.made('invoicing')), '22023', 'key');
  perform pg_temp.refused(format('select public.product_knowledge_propose(%L, %L, ''domains'', ''remove'', %L, ''{}'')', pg_temp.id('pd'), pg_temp.id('stock'), pg_temp.made('invoicing')), '22023', 'action');
  perform pg_temp.refused(format('select public.product_knowledge_propose(%L, %L, ''domains'', ''edit'', %L, ''{"name": "A"}'')', pg_temp.id('pd'), pg_temp.id('payroll'), pg_temp.made('invoicing')), 'P0002', 'entry');
  if exists (select 1 from public.product_domains d where d.name in ('A', 'Again', 'Planted', 'P')) then
    raise exception 'FAIL: a refused domain was stored';
  end if;
end $$;
reset role;

-- ── Edit and retire: the name and meaning change, the key never; a retired domain is kept ──
set local role authenticated;
do $$
declare
  n bigint;
  d public.product_domains;
  e public.product_knowledge_events;
  p public.product_knowledge_proposals;
begin
  perform pg_temp.as_('dina');
  n := pg_temp.events();
  d := public.product_domain_edit(pg_temp.id('pd'), pg_temp.made('invoicing'), 'Billing', null);
  e := pg_temp.one_event(n, 'edited');
  if d.key <> 'invoicing' or d.name <> 'Billing' or d.meaning <> 'Billing a customer for what they bought.'
     or e.domain_id <> d.id or e.before->>'name' <> 'Invoicing' or e.after->>'name' <> 'Billing' or e.after->>'key' <> 'invoicing' then
    raise exception 'FAIL: editing invoicing''s name: % %', d, e;
  end if;
  perform public.product_domain_edit(pg_temp.id('pd'), pg_temp.made('invoicing'), ' Billing ', 'Billing a customer for what they bought.');
  if pg_temp.events() <> n + 1 then raise exception 'FAIL: a domain edit that changes nothing logged an event'; end if;

  -- Max proposes a new meaning; Del, the delegate, approves it.
  perform pg_temp.as_('max');
  p := public.product_knowledge_propose(pg_temp.id('pd'), pg_temp.id('stock'), 'domains', 'edit', pg_temp.made('invoicing'),
         '{"meaning": "Billing a customer, and crediting them back."}');
  if p.domain_id <> pg_temp.made('invoicing') then raise exception 'FAIL: an edit''s proposal does not name its domain: %', p; end if;
  perform pg_temp.as_('del');
  n := pg_temp.events();
  p := public.product_knowledge_approve(pg_temp.id('pd'), p.id);
  e := pg_temp.one_event(n, 'approved');
  d := pg_temp.domain(pg_temp.made('invoicing'));
  if p.decided_by <> pg_temp.id('del') or d.meaning <> 'Billing a customer, and crediting them back.' or d.name <> 'Billing'
     or e.domain_id <> d.id or e.before->>'meaning' <> 'Billing a customer for what they bought.' then
    raise exception 'FAIL: the delegate approving an edit: % % %', p, d, e;
  end if;

  -- Dina retires planning: kept, marked retired; it cannot be retired, edited or proposed again, and
  -- its key is never reused.
  perform pg_temp.as_('dina');
  n := pg_temp.events();
  d := public.product_domain_retire(pg_temp.id('pd'), pg_temp.made('planning'));
  e := pg_temp.one_event(n, 'retired');
  if d.retired_at is null or d.retired_by <> pg_temp.id('dina') or d.key <> 'planning' or e.after is not null
     or e.before->>'key' <> 'planning' or e.domain_id <> d.id then
    raise exception 'FAIL: retiring planning: % %', d, e;
  end if;
  if pg_temp.domain(pg_temp.made('planning')) is null then raise exception 'FAIL: a retired domain was deleted'; end if;
  perform pg_temp.refused(format('select public.product_domain_retire(%L, %L)', pg_temp.id('pd'), pg_temp.made('planning')), 'P0002', 'entry');
  perform pg_temp.refused(format('select public.product_domain_edit(%L, %L, ''Back'')', pg_temp.id('pd'), pg_temp.made('planning')), 'P0002', 'entry');
  perform pg_temp.refused(format('select public.product_domain_add(%L, %L, ''planning'', ''Planning'', ''Again.'')', pg_temp.id('pd'), pg_temp.id('stock')), '22023', 'key');
  perform pg_temp.as_('max');
  perform pg_temp.refused(format('select public.product_knowledge_propose(%L, %L, ''domains'', ''add'', null, ''{"key": "planning", "name": "P", "meaning": "Again."}'')', pg_temp.id('pd'), pg_temp.id('stock')), '22023', 'key');
  perform pg_temp.refused(format('select public.product_knowledge_propose(%L, %L, ''domains'', ''retire'', %L, ''{}'')', pg_temp.id('pd'), pg_temp.id('stock'), pg_temp.made('planning')), 'P0002', 'entry');
  -- An open proposal to retire a domain, left for the page's read.
  perform public.product_knowledge_propose(pg_temp.id('pd'), pg_temp.id('stock'), 'domains', 'retire', pg_temp.made('invoicing'), '{}');
end $$;
reset role;

-- ── The page's read: the Domains section, with what the reader may do ──
set local role authenticated;
do $$
declare got jsonb;
begin
  perform pg_temp.as_('max');
  got := public.product_knowledge_of(pg_temp.id('pd'), pg_temp.id('stock'));
  if got->'domains'->'owner' <> jsonb_build_object('user', pg_temp.id('dina'), 'login', 'dina@pd.test')
     or got->'domains'->'delegate'->>'login' <> 'del@pd.test' or (got->'domains'->>'decides')::boolean then
    raise exception 'FAIL: the page read''s Domains owner, delegate and decides for Max: %', got->'domains';
  end if;
  if (select string_agg(x->>'key', ',') from jsonb_array_elements(got->'domains'->'entries') x) <> 'invoicing,planning,' || repeat('x', 60)
     or got->'domains'->'entries'->1->>'retiredAt' is null or got->'domains'->'entries'->0->>'retiredAt' is not null
     or got->'domains'->'entries'->0->>'name' <> 'Billing' or got->'domains'->'entries'->0->>'entry' <> pg_temp.made('invoicing')::text
     or got->'domains'->'entries'->0->'createdBy' <> jsonb_build_object('user', pg_temp.id('olga'), 'login', 'olga@pd.test')
     or got->'domains'->'entries'->0->'createdAt' is null or got->'domains'->'entries'->0->'updatedAt' is null then
    raise exception 'FAIL: the page read''s domains: %', got->'domains'->'entries';
  end if;
  if jsonb_array_length(got->'domains'->'proposals') <> 1 or got->'domains'->'proposals'->0->>'action' <> 'retire'
     or got->'domains'->'proposals'->0->>'entry' <> pg_temp.made('invoicing')::text
     or got->'domains'->'proposals'->0->'proposedBy'->>'login' <> 'max@pd.test' then
    raise exception 'FAIL: the page read''s open domain proposals: %', got->'domains'->'proposals';
  end if;
  if jsonb_array_length(got->'legal'->'entries') <> 0 or jsonb_array_length(got->'glossary'->'proposals') <> 0 then
    raise exception 'FAIL: a domain shows under another kind: %', got;
  end if;
  perform pg_temp.as_('del');
  if not (public.product_knowledge_of(pg_temp.id('pd'), pg_temp.id('stock'))->'domains'->>'decides')::boolean then
    raise exception 'FAIL: the delegate does not decide the domains';
  end if;
end $$;
reset role;

-- ── Nobody writes the table directly; another workspace and a stranger read nothing ──
create temporary table before_refusals as select pg_temp.store() as s;
grant select on before_refusals to anon, authenticated, service_role;
set local role authenticated;
do $$
declare
  c text;
  person text;
begin
  perform pg_temp.as_('max');
  if (select count(*) from public.product_domains) <> 4 then
    raise exception 'FAIL: a member does not read every domain of their workspace: %', (select count(*) from public.product_domains);
  end if;
  foreach person in array array['max', 'dina', 'olga'] loop
    perform pg_temp.as_(person);
    foreach c in array array[
      format('insert into public.product_domains (workspace_id, product_id, key, name, meaning) values (%L, %L, ''planted'', ''P'', ''P'')', pg_temp.id('pd'), pg_temp.id('stock')),
      format('update public.product_domains set key = ''billing'' where id = %L', pg_temp.made('invoicing')),
      'update public.product_domains set retired_at = null',
      'delete from public.product_domains',
      'update public.product_knowledge_events set domain_id = null',
      'delete from public.product_knowledge_events'
    ] loop perform pg_temp.refused(c, '42501'); end loop;
  end loop;

  foreach person in array array['carl', 'sam'] loop
    perform pg_temp.as_(person);
    foreach c in array array[
      format('select public.product_domain_add(%L, %L, ''planted'', ''P'', ''P'')', pg_temp.id('pd'), pg_temp.id('stock')),
      format('select public.product_domain_edit(%L, %L, ''Planted'')', pg_temp.id('pd'), pg_temp.made('invoicing')),
      format('select public.product_domain_retire(%L, %L)', pg_temp.id('pd'), pg_temp.made('invoicing')),
      format('select public.product_knowledge_propose(%L, %L, ''domains'', ''add'', null, ''{"key": "planted", "name": "P", "meaning": "P"}'')', pg_temp.id('pd'), pg_temp.id('stock')),
      format('select public.product_knowledge_of(%L, %L)', pg_temp.id('pd'), pg_temp.id('stock'))
    ] loop perform pg_temp.refused(c, '42501'); end loop;
    if exists (select 1 from public.product_domains) or exists (select 1 from public.product_knowledge_events where kind = 'domains') then
      raise exception 'FAIL: % reads PD''s domains', person;
    end if;
  end loop;
  -- Carl owns Other, so he passes its checks, but PD's products and domains are not Other's.
  perform pg_temp.as_('carl');
  perform pg_temp.refused(format('select public.product_domain_add(%L, %L, ''planted'', ''P'', ''P'')', pg_temp.id('other'), pg_temp.id('stock')), 'P0002', 'product');
  perform pg_temp.refused(format('select public.product_domain_edit(%L, %L, ''Planted'')', pg_temp.id('other'), pg_temp.made('invoicing')), 'P0002', 'entry');
  perform pg_temp.refused(format('select public.product_domain_retire(%L, %L)', pg_temp.id('other'), pg_temp.made('invoicing')), 'P0002', 'entry');
  perform pg_temp.refused(format('select public.product_knowledge_propose(%L, %L, ''domains'', ''retire'', %L, ''{}'')', pg_temp.id('other'), pg_temp.id('widgets'), pg_temp.made('invoicing')), 'P0002', 'entry');
end $$;
reset role;

set local role service_role;
do $$
declare c text;
begin
  foreach c in array array[
    format('insert into public.product_domains (workspace_id, product_id, key, name, meaning) values (%L, %L, ''planted'', ''P'', ''P'')', pg_temp.id('pd'), pg_temp.id('stock')),
    'update public.product_domains set retired_at = null',
    'delete from public.product_domains',
    format('select public.product_domain_add(%L, %L, ''planted'', ''P'', ''P'')', pg_temp.id('pd'), pg_temp.id('stock')),
    format('select public.product_domain_live(%L, %L, %L)', pg_temp.id('pd'), pg_temp.id('stock'), pg_temp.made('invoicing'))
  ] loop perform pg_temp.refused(c, '42501'); end loop;
end $$;
reset role;

do $$
begin
  if pg_temp.store() <> (select s from before_refusals) then
    raise exception 'FAIL: a refused call changed the domains or their history';
  end if;
end $$;

-- ── A term names none, one or several domains of its product (PRD 2583 s2) ──
-- Dina owns the Domains; nobody is named for the Glossary, so Olga decides it and Max proposes.
create function pg_temp.term_domains(entry uuid) returns text language sql security definer as $$
  select coalesce(string_agg(d.key, ',' order by d.key), '')
    from public.product_glossary_domains l join public.product_domains d on d.id = l.domain_id where l.glossary_id = entry;
$$;
set local role authenticated;
do $$
declare
  n bigint;
  e public.product_knowledge_events;
  legacy public.product_domains;
  t public.product_glossary;
  t2 public.product_glossary;
  p public.product_knowledge_proposals;
  pd uuid := pg_temp.id('pd');
  stock uuid := pg_temp.id('stock');
  got jsonb;
begin
  perform pg_temp.as_('dina');
  legacy := public.product_domain_add(pd, stock, 'legacy', 'Legacy', 'An old part of Stock.');
  insert into made values ('legacy', legacy.id);

  -- None, one or several, by key; the event keeps them. A term that names none records what it always did.
  perform pg_temp.as_('olga');
  n := pg_temp.events();
  t := public.product_glossary_add(pd, stock, 'Stock take', 'Counting what is on the shelves.', array['inventory'], array['invoicing', ' legacy ', 'invoicing']);
  e := pg_temp.newest();
  if e.glossary_id <> t.id or e.action <> 'added' or pg_temp.events() <> n + 1 or e.after->'domains' <> '["invoicing", "legacy"]'::jsonb
     or pg_temp.term_domains(t.id) <> 'invoicing,legacy' then
    raise exception 'FAIL: a term naming two domains (once each, trimmed): % %', pg_temp.term_domains(t.id), e;
  end if;
  insert into made values ('stock-take', t.id);
  t2 := public.product_glossary_add(pd, stock, 'Shelf', 'Where stock sits.');
  e := pg_temp.newest();
  if pg_temp.term_domains(t2.id) <> '' or e.after ? 'domains' or e.after <> jsonb_build_object('term', 'Shelf', 'meaning', 'Where stock sits.', 'avoid', '[]'::jsonb) then
    raise exception 'FAIL: a term naming no domain is cross-domain and records no field for it: % %', pg_temp.term_domains(t2.id), e;
  end if;
  insert into made values ('shelf', t2.id);
  got := public.product_knowledge_of(pd, stock)->'glossary'->'entries';
  if (select x->'domains' from jsonb_array_elements(got) x where x->>'term' = 'Stock take') <> '["invoicing", "legacy"]'::jsonb
     or (select x->'domains' from jsonb_array_elements(got) x where x->>'term' = 'Shelf') <> '[]'::jsonb then
    raise exception 'FAIL: the page does not read each term''s domains: %', got;
  end if;

  -- A key the product does not have, a retired one, an invalid one and another product's: refused, naming `domains`.
  perform pg_temp.refused(format('select public.product_glossary_add(%L, %L, ''Pallet'', ''A'', ''{}'', array[''nowhere''])', pd, stock), '22023', 'domains');
  perform pg_temp.refused(format('select public.product_glossary_add(%L, %L, ''Pallet'', ''A'', ''{}'', array[''planning''])', pd, stock), '22023', 'domains');
  perform pg_temp.refused(format('select public.product_glossary_add(%L, %L, ''Pallet'', ''A'', ''{}'', array[''Bad Key''])', pd, stock), '22023', 'domains');
  perform pg_temp.refused(format('select public.product_glossary_add(%L, %L, ''Pallet'', ''A'', ''{}'', array[%L])', pd, pg_temp.id('payroll'), repeat('x', 60)), '22023', 'domains');
  perform pg_temp.refused(format('select public.product_glossary_edit(%L, %L, null, null, null, array[''planning''])', pd, t2.id), '22023', 'domains');
  perform pg_temp.refused(format('select public.product_knowledge_propose(%L, %L, ''glossary'', ''add'', null, ''{"term": "Pallet", "meaning": "A", "domains": ["planning"]}'')', pd, stock), '22023', 'domains');
  perform pg_temp.refused(format('select public.product_knowledge_propose(%L, %L, ''glossary'', ''edit'', %L, ''{"domains": "invoicing"}'')', pd, stock, t2.id), '22023', 'domains');
  if (select count(*) from public.product_glossary g where g.term = 'Pallet') <> 0 then
    raise exception 'FAIL: a refused term was added';
  end if;

  -- An edit sets them, and leaves one event; the same ones change nothing and log nothing.
  n := pg_temp.events();
  perform public.product_glossary_edit(pd, t2.id, null, null, null, array['invoicing']);
  e := pg_temp.newest();
  if pg_temp.events() <> n + 1 or e.action <> 'edited' or e.before ? 'domains' or e.after->'domains' <> '["invoicing"]'::jsonb
     or pg_temp.term_domains(t2.id) <> 'invoicing' then
    raise exception 'FAIL: an edit naming a domain: % %', pg_temp.term_domains(t2.id), e;
  end if;
  perform public.product_glossary_edit(pd, t2.id, null, null, null, array['invoicing']);
  if pg_temp.events() <> n + 1 then raise exception 'FAIL: naming the same domains logged an event'; end if;
  perform public.product_glossary_edit(pd, t2.id, 'Shelf', null, null, null);
  if pg_temp.events() <> n + 1 or pg_temp.term_domains(t2.id) <> 'invoicing' then
    raise exception 'FAIL: a null keeps the term''s domains';
  end if;
  perform public.product_glossary_edit(pd, t2.id, null, null, null, '{}'::text[]);
  if pg_temp.events() <> n + 2 or pg_temp.term_domains(t2.id) <> '' or not (pg_temp.newest()).before @> '{"domains": ["invoicing"]}'::jsonb then
    raise exception 'FAIL: an empty list did not clear the term''s domains: %', pg_temp.newest();
  end if;

  -- Dina retires legacy: the link made before stays, and shows; no new link to it is made.
  perform pg_temp.as_('dina');
  perform public.product_domain_retire(pd, legacy.id);
  perform pg_temp.as_('olga');
  if pg_temp.term_domains(t.id) <> 'invoicing,legacy' then raise exception 'FAIL: retiring a domain unlinked its terms'; end if;
  perform pg_temp.refused(format('select public.product_glossary_edit(%L, %L, null, null, null, array[''legacy''])', pd, t2.id), '22023', 'domains');
  perform pg_temp.refused(format('select public.product_knowledge_propose(%L, %L, ''glossary'', ''edit'', %L, ''{"domains": ["legacy"]}'')', pd, stock, t2.id), '22023', 'domains');
  -- The term keeps its old link while another is named, and while the list is emptied.
  perform public.product_glossary_edit(pd, t.id, null, null, null, array['legacy', 'invoicing']);
  if pg_temp.term_domains(t.id) <> 'invoicing,legacy' then raise exception 'FAIL: naming an old link again changed it'; end if;
  n := pg_temp.events();
  perform public.product_glossary_edit(pd, t.id, null, null, null, array[]::text[]);
  if pg_temp.term_domains(t.id) <> 'legacy' or pg_temp.events() <> n + 1 then
    raise exception 'FAIL: clearing a term''s domains lost the retired link or logged wrongly: %', pg_temp.term_domains(t.id);
  end if;
  perform public.product_glossary_edit(pd, t.id, null, null, null, array['invoicing']);
  if pg_temp.term_domains(t.id) <> 'invoicing,legacy' then raise exception 'FAIL: naming a live domain beside a retired link'; end if;

  -- A member who may only propose proposes the same: nothing is linked until it is approved.
  perform pg_temp.as_('max');
  p := public.product_knowledge_propose(pd, stock, 'glossary', 'add', null, '{"term": "Pallet", "meaning": "A load.", "domains": ["invoicing", "invoicing"]}');
  if p.fields->'domains' <> '["invoicing"]'::jsonb or exists (select 1 from public.product_glossary g where g.term = 'Pallet') then
    raise exception 'FAIL: a proposed term with domains: %', p;
  end if;
  perform pg_temp.refused(format('select public.product_glossary_add(%L, %L, ''X'', ''Y'', ''{}'', array[''invoicing''])', pd, stock), '42501');
  perform pg_temp.as_('olga');
  p := public.product_knowledge_approve(pd, p.id);
  if pg_temp.term_domains(p.glossary_id) <> 'invoicing' then
    raise exception 'FAIL: approving a proposed term did not link its domains';
  end if;
  insert into made values ('pallet', p.glossary_id);
end $$;
reset role;

-- A link to another product's domain cannot exist, even written past the functions; and only the functions write.
do $$
begin
  perform pg_temp.refused(format(
    'insert into public.product_glossary_domains (glossary_id, domain_id, workspace_id, product_id) values (%L, (select d.id from public.product_domains d where d.product_id = %L and d.key = ''invoicing''), %L, %L)',
    pg_temp.made('stock-take'), pg_temp.id('payroll'), pg_temp.id('pd'), pg_temp.id('stock')), '23503');
  perform pg_temp.refused(format(
    'insert into public.product_glossary_domains (glossary_id, domain_id, workspace_id, product_id) values (%L, %L, %L, %L)',
    pg_temp.made('shelf'), pg_temp.made('invoicing'), pg_temp.id('pd'), pg_temp.id('payroll')), '23503');
end $$;
set local role authenticated;
do $$
declare c text;
begin
  perform pg_temp.as_('olga');
  foreach c in array array[
    format('insert into public.product_glossary_domains (glossary_id, domain_id, workspace_id, product_id) values (%L, %L, %L, %L)', pg_temp.made('shelf'), pg_temp.made('invoicing'), pg_temp.id('pd'), pg_temp.id('stock')),
    'update public.product_glossary_domains set linked_at = now()',
    'delete from public.product_glossary_domains',
    format('select public.product_glossary_domain_link(%L, %L, ''["invoicing"]'')', pg_temp.id('stock'), pg_temp.made('shelf')),
    format('select public.product_glossary_domain_check(%L, null, ''[]'')', pg_temp.id('stock'))
  ] loop perform pg_temp.refused(c, '42501'); end loop;
  -- A member reads their workspace's links; a member of another workspace and a stranger read none.
  if (select count(*) from public.product_glossary_domains) < 3 then raise exception 'FAIL: a member reads no term domains'; end if;
  foreach c in array array['carl', 'sam'] loop
    perform pg_temp.as_(c);
    if exists (select 1 from public.product_glossary_domains) then raise exception 'FAIL: % reads PD''s term domains', c; end if;
  end loop;
end $$;
reset role;
set local role anon;
do $$
begin
  perform pg_temp.refused('select * from public.product_glossary_domains', '42501');
  perform pg_temp.refused(format('select public.product_glossary_add(%L, %L, ''Planted'', ''P'', ''{}'', array[''invoicing''])', pg_temp.id('pd'), pg_temp.id('stock')), '42501');
end $$;
reset role;

-- ── An archived product's domains change no more ──
set local role authenticated;
do $$
begin
  perform pg_temp.as_('olga');
  perform public.product_archive(pg_temp.id('payroll'));
  perform pg_temp.refused(format('select public.product_domain_add(%L, %L, ''planted'', ''P'', ''P'')', pg_temp.id('pd'), pg_temp.id('payroll')), 'P0002', 'product');
  perform pg_temp.refused(format('select public.product_domain_retire(%L, (select d.id from public.product_domains d where d.product_id = %L))', pg_temp.id('pd'), pg_temp.id('payroll')), 'P0002', 'product');
end $$;
reset role;

-- ── The folders of a product's repositories: a member reads them, nobody else reads a name (PRD 2583 s3) ──
-- Not on the list reads the newest knowledge pack of each repository the product links, and of its plan
-- repository, as the signed-in person: the same tables the Repositories section reads (BR-PRODUCT-63). A
-- folder is a directory directly under <knowledge root>/domains/; imported copies under repos/<target>/domains/
-- are carried by the pack and left out by the page. Nothing here fails a check.
insert into public.repositories (workspace_id, full_name) values
  (pg_temp.id('pd'), 'pd-org/stock-api'), (pg_temp.id('pd'), 'pd-org/stock-plan'), (pg_temp.id('other'), 'pd-other/widgets-api');
insert into public.product_repositories (product_id, workspace_id, repository, added_by) values
  (pg_temp.id('stock'), pg_temp.id('pd'), 'pd-org/stock-api', 'person'),
  (pg_temp.id('stock'), pg_temp.id('pd'), 'pd-org/stock-plan', 'person'),
  (pg_temp.id('widgets'), pg_temp.id('other'), 'pd-other/widgets-api', 'person');
update public.products set plan_repository = 'pd-org/stock-plan' where id = pg_temp.id('stock');
set local role service_role;
do $$
begin
  perform public.knowledge_pack_put('pd-org/stock-api', repeat('a', 40), '2026-12-12 09:00+00', jsonb_build_array(
    jsonb_build_object('path', '.omni-loop/knowledge/domains/planning/rules.md', 'content', E'# Planning\n'),
    jsonb_build_object('path', '.omni-loop/knowledge/domains/stock-levels/README.md', 'content', E'# Stock levels\n\nWhat is on the shelves.\n')));
  perform public.knowledge_pack_put('pd-org/stock-plan', repeat('b', 40), '2026-12-12 09:00+00', jsonb_build_array(
    jsonb_build_object('path', '.omni-loop/knowledge/domains/planning/rules.md', 'content', E'# Planning\n'),
    jsonb_build_object('path', '.omni-loop/knowledge/repos/backend/domains/imported/rules.md', 'content', E'# Imported\n')));
  perform public.knowledge_pack_put('pd-other/widgets-api', repeat('c', 40), '2026-12-12 09:00+00', jsonb_build_array(
    jsonb_build_object('path', '.omni-loop/knowledge/domains/secret-sprocket/rules.md', 'content', E'# Secret\n')));
end $$;
reset role;
-- What the page reads of Stock, as a person: the repositories, then each one's newest pack's folders.
create function pg_temp.folders_seen(product uuid) returns text language sql as $$
  select coalesce(string_agg(distinct split_part(substr(f.path, length('.omni-loop/knowledge/domains/') + 1), '/', 1), ',' order by
           split_part(substr(f.path, length('.omni-loop/knowledge/domains/') + 1), '/', 1)), '')
    from public.products p
    join public.product_repositories l on l.product_id = p.id
    join public.knowledge_packs k on k.repository = l.repository and k.newest
    join public.knowledge_pack_files f on f.pack_id = k.id and f.path like '.omni-loop/knowledge/domains/%/%'
   where p.id = folders_seen.product;
$$;
set local role authenticated;
do $$
declare
  c text;
begin
  -- A member, who only proposes or who decides, reads the folders of Stock's repositories and its plan repository.
  foreach c in array array['max', 'dina', 'olga'] loop
    perform pg_temp.as_(c);
    if pg_temp.folders_seen(pg_temp.id('stock')) <> 'planning,stock-levels' then
      raise exception 'FAIL: % reads the folders % of Stock, not planning and stock-levels', c, pg_temp.folders_seen(pg_temp.id('stock'));
    end if;
    if (select p.plan_repository from public.products p where p.id = pg_temp.id('stock')) is distinct from 'pd-org/stock-plan'
       or (select count(*) from public.knowledge_packs k where k.newest and k.repository in ('pd-org/stock-api', 'pd-org/stock-plan')) <> 2 then
      raise exception 'FAIL: % does not read Stock''s plan repository and its two packs', c;
    end if;
  end loop;
  -- A member of another workspace reads no repository, pack or folder of PD: only their own.
  perform pg_temp.as_('carl');
  if pg_temp.folders_seen(pg_temp.id('stock')) <> '' or exists (select 1 from public.products p where p.id = pg_temp.id('stock'))
     or exists (select 1 from public.product_repositories l where l.product_id = pg_temp.id('stock'))
     or exists (select 1 from public.knowledge_packs k where k.repository like 'pd-org/%')
     or exists (select 1 from public.knowledge_pack_files f where f.path like '%planning%' or f.path like '%stock-levels%') then
    raise exception 'FAIL: a member of another workspace reads a folder of PD''s repositories';
  end if;
  if pg_temp.folders_seen(pg_temp.id('widgets')) <> 'secret-sprocket' then
    raise exception 'FAIL: a member does not read their own workspace''s folders';
  end if;
  -- A stranger reads nothing at all, of either workspace.
  perform pg_temp.as_('sam');
  if pg_temp.folders_seen(pg_temp.id('stock')) <> '' or pg_temp.folders_seen(pg_temp.id('widgets')) <> ''
     or exists (select 1 from public.knowledge_packs) or exists (select 1 from public.knowledge_pack_files)
     or exists (select 1 from public.product_repositories l where l.repository in ('pd-org/stock-api', 'pd-org/stock-plan', 'pd-other/widgets-api')) then
    raise exception 'FAIL: a stranger reads a repository, a pack or a folder name';
  end if;
end $$;
reset role;
set local role anon;
do $$
begin
  perform pg_temp.refused('select * from public.knowledge_packs', '42501');
  perform pg_temp.refused('select * from public.knowledge_pack_files', '42501');
end $$;
reset role;

-- ── Every change left exactly one event, and every event is a change ──
do $$
begin
  -- Direct changes: invoicing (Stock), invoicing (Payroll), the sixty-character key and legacy added; one
  -- edit (the edit that changed nothing logged none); planning and legacy retired.
  if (select count(*) from public.product_knowledge_events e where e.kind = 'domains' and e.action in ('added', 'edited', 'retired', 'removed')) <> 4 + 1 + 2 then
    raise exception 'FAIL: % domain events, not one per direct change',
      (select count(*) from public.product_knowledge_events e where e.kind = 'domains' and e.action in ('added', 'edited', 'retired', 'removed'));
  end if;
  if (select count(*) from public.product_knowledge_events e where e.kind = 'domains' and e.action = 'proposed')
       <> (select count(*) from public.product_knowledge_proposals p where p.kind = 'domains')
     or (select count(*) from public.product_knowledge_events e where e.kind = 'domains' and e.action in ('approved', 'rejected'))
       <> (select count(*) from public.product_knowledge_proposals p where p.kind = 'domains' and p.state <> 'open') then
    raise exception 'FAIL: a domain proposal or decision does not have exactly one event';
  end if;
end $$;

-- ── A deleted account leaves its domains and their history, naming nobody (L-GDPR-3) ──
delete from auth.users where id = '00000000-0000-4000-8000-0000002583a1';
do $$
begin
  if (pg_temp.domain(pg_temp.made('invoicing'))).created_by is not null or pg_temp.domain(pg_temp.made('invoicing')) is null
     or not exists (select 1 from public.product_knowledge_events e where e.domain_id = pg_temp.made('invoicing') and e.action = 'added') then
    raise exception 'FAIL: deleting the author''s account lost the domain or its history';
  end if;
end $$;

rollback;

\echo 'product_domains: every check passed'
