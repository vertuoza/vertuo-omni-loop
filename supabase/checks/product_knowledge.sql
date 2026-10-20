-- Who may read and change a product's knowledge, its Legal entries and its glossary (PRD 1795,
-- 20261212110000_product_knowledge.sql). The supabase workflow runs it on every pull request, after
-- `supabase db start` has applied the migrations and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/product_knowledge.sql
-- Each row of the spec's "Who changes it": a workspace owner names each kind's owner and delegate; the
-- kind's owner or delegate adds, edits and retires (Legal) or removes (Glossary) entries and approves or
-- rejects proposals; while a kind names neither, the workspace's owners act as its owner; any other
-- member proposes; anyone outside the workspace, or signed out, reads nothing and writes nothing. A
-- refusal is 42501 (not allowed), P0002 (no such product, entry or proposal) or 22023 (a bad value, the
-- field in `hint`), and changes nothing. A Legal entry's number is the next for its code in its product
-- and never reused, even after a retirement; a retired entry and a removed term keep their rows; a live
-- term is unique without case. Every change appends exactly one event, in the same transaction; nobody
-- writes any of the five tables directly, the service role included, and nobody rewrites an event.
-- The page's read names who added each Legal entry and term, and when it was added and last changed
-- (PRD 2240 s1, 20261218090000_product_knowledge_authors.sql). What business_for_repo() answers of them
-- is supabase/checks/business.sql's.
--
-- One transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

-- ── Nothing seeded ──
do $$
begin
  if exists (select 1 from public.product_knowledge_owners) or exists (select 1 from public.product_legal)
     or exists (select 1 from public.product_glossary) or exists (select 1 from public.product_knowledge_events)
     or exists (select 1 from public.product_knowledge_proposals) then
    raise exception 'FAIL: product knowledge exists before anyone wrote any';
  end if;
end $$;

-- ── The cast ──
-- PK (github_org pk-org): Owen owns it; Lena, Dan, Gus, Mia and Lee are members. Lena will own Legal and
-- Dan stand in for her, Gus will own the Glossary, Mia only ever proposes, Lee leaves. Carl owns Other;
-- Sam belongs to no workspace. PK sells Invoicing and Payroll; Other sells Widgets.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000001795a1', 'owen@pk.test'),
  ('00000000-0000-4000-8000-0000001795a2', 'lena@pk.test'),
  ('00000000-0000-4000-8000-0000001795a3', 'dan@pk.test'),
  ('00000000-0000-4000-8000-0000001795a4', 'gus@pk.test'),
  ('00000000-0000-4000-8000-0000001795a5', 'mia@pk.test'),
  ('00000000-0000-4000-8000-0000001795a6', 'lee@pk.test'),
  ('00000000-0000-4000-8000-0000001795c1', 'carl@pk-other.test'),
  ('00000000-0000-4000-8000-0000001795d1', 'sam@nowhere.test');
insert into public.workspaces (id, slug, name, github_org) values
  ('00000000-0000-4000-8000-000000179500', 'pk', 'PK', 'pk-org'),
  ('00000000-0000-4000-8000-000000179501', 'pk-other', 'Other', 'pk-other');
insert into public.workspace_members (workspace_id, user_id, role) values
  ('00000000-0000-4000-8000-000000179500', '00000000-0000-4000-8000-0000001795a1', 'owner'),
  ('00000000-0000-4000-8000-000000179500', '00000000-0000-4000-8000-0000001795a2', 'member'),
  ('00000000-0000-4000-8000-000000179500', '00000000-0000-4000-8000-0000001795a3', 'member'),
  ('00000000-0000-4000-8000-000000179500', '00000000-0000-4000-8000-0000001795a4', 'member'),
  ('00000000-0000-4000-8000-000000179500', '00000000-0000-4000-8000-0000001795a5', 'member'),
  ('00000000-0000-4000-8000-000000179500', '00000000-0000-4000-8000-0000001795a6', 'member'),
  ('00000000-0000-4000-8000-000000179501', '00000000-0000-4000-8000-0000001795c1', 'owner');
-- Lena's player carries her GitHub login: the login agents read as an entry's owner.
insert into public.players (workspace_id, user_id, display_name, github_login, hero) values
  ('00000000-0000-4000-8000-000000179500', '00000000-0000-4000-8000-0000001795a2', 'LENA', 'Lena-GH',
   '{"v":1,"body":"girl","skin":2,"hair":3,"suit":0,"cape":8}');
insert into public.businesses (id, workspace_id, name) values
  ('00000000-0000-4000-8000-0000001795b0', '00000000-0000-4000-8000-000000179500', 'PK'),
  ('00000000-0000-4000-8000-0000001795b1', '00000000-0000-4000-8000-000000179501', 'Other');
insert into public.products (id, workspace_id, business_id, name) values
  ('00000000-0000-4000-8000-0000001795e1', '00000000-0000-4000-8000-000000179500', '00000000-0000-4000-8000-0000001795b0', 'Invoicing'),
  ('00000000-0000-4000-8000-0000001795e2', '00000000-0000-4000-8000-000000179500', '00000000-0000-4000-8000-0000001795b0', 'Payroll'),
  ('00000000-0000-4000-8000-0000001795e3', '00000000-0000-4000-8000-000000179501', '00000000-0000-4000-8000-0000001795b1', 'Widgets');

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
-- Who is who, by first name.
create temporary table who (name text primary key, id uuid);
insert into who values
  ('owen', '00000000-0000-4000-8000-0000001795a1'), ('lena', '00000000-0000-4000-8000-0000001795a2'),
  ('dan', '00000000-0000-4000-8000-0000001795a3'), ('gus', '00000000-0000-4000-8000-0000001795a4'),
  ('mia', '00000000-0000-4000-8000-0000001795a5'), ('lee', '00000000-0000-4000-8000-0000001795a6'),
  ('carl', '00000000-0000-4000-8000-0000001795c1'), ('sam', '00000000-0000-4000-8000-0000001795d1'),
  ('pk', '00000000-0000-4000-8000-000000179500'), ('other', '00000000-0000-4000-8000-000000179501'),
  ('invoicing', '00000000-0000-4000-8000-0000001795e1'), ('payroll', '00000000-0000-4000-8000-0000001795e2'),
  ('widgets', '00000000-0000-4000-8000-0000001795e3');
grant select on who to anon, authenticated, service_role;
create function pg_temp.id(name text) returns uuid language sql as $$
  select w.id from who w where w.name = id.name;
$$;
create function pg_temp.as_(name text) returns void language sql as $$
  select pg_temp.sign_in(pg_temp.id(name)::text);
$$;
-- What the people made, read back by later blocks and outsiders' calls.
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
-- Everything the five tables hold, as one value to compare before and after refusals.
create function pg_temp.store() returns text language sql security definer as $$
  select concat_ws('|',
    (select string_agg(row(o.*)::text, ';' order by o.product_id, o.kind, o.role) from public.product_knowledge_owners o),
    (select string_agg(row(l.*)::text, ';' order by l.id) from public.product_legal l),
    (select string_agg(row(g.*)::text, ';' order by g.id) from public.product_glossary g),
    (select string_agg(row(p.*)::text, ';' order by p.id) from public.product_knowledge_proposals p),
    (select string_agg(row(e.*)::text, ';' order by e.id) from public.product_knowledge_events e));
$$;
-- How many events there are, and the newest one.
create function pg_temp.events() returns bigint language sql security definer as $$
  select count(*) from public.product_knowledge_events;
$$;
create function pg_temp.newest() returns public.product_knowledge_events language sql security definer as $$
  select * from public.product_knowledge_events e order by e.id desc limit 1;
$$;
-- Fails unless exactly one event was appended since `was` events, with `action` (and `kind`).
create function pg_temp.one_event(was bigint, action text, kind text) returns public.product_knowledge_events
language plpgsql security definer as $$
declare e public.product_knowledge_events := pg_temp.newest();
begin
  if pg_temp.events() <> was + 1 or e.action <> action or e.kind <> kind then
    raise exception 'FAIL: want exactly one % event of %, got % new, the newest %', action, kind, pg_temp.events() - was, e;
  end if;
  return e;
end;
$$;
-- A Legal entry or a glossary term as it is stored, read past row-level security.
create function pg_temp.legal(entry uuid) returns public.product_legal language sql security definer as $$
  select * from public.product_legal l where l.id = entry;
$$;
create function pg_temp.term(entry uuid) returns public.product_glossary language sql security definer as $$
  select * from public.product_glossary g where g.id = entry;
$$;
create function pg_temp.proposal(p uuid) returns public.product_knowledge_proposals language sql security definer as $$
  select * from public.product_knowledge_proposals x where x.id = p;
$$;

-- ── Signed out: no function runs, nothing is read ──
set local role anon;
do $$
declare c text;
begin
  foreach c in array array[
    format('select public.product_knowledge_name(%L, %L, ''legal'', ''owner'', %L)', pg_temp.id('pk'), pg_temp.id('invoicing'), pg_temp.id('lena')),
    format('select public.product_legal_add(%L, %L, ''INVOICING'', ''Planted'', ''Planted'')', pg_temp.id('pk'), pg_temp.id('invoicing')),
    format('select public.product_legal_edit(%L, gen_random_uuid(), ''Planted'')', pg_temp.id('pk')),
    format('select public.product_legal_retire(%L, gen_random_uuid())', pg_temp.id('pk')),
    format('select public.product_glossary_add(%L, %L, ''Planted'', ''Planted'')', pg_temp.id('pk'), pg_temp.id('invoicing')),
    format('select public.product_glossary_edit(%L, gen_random_uuid(), ''Planted'')', pg_temp.id('pk')),
    format('select public.product_glossary_remove(%L, gen_random_uuid())', pg_temp.id('pk')),
    format('select public.product_knowledge_propose(%L, %L, ''glossary'', ''add'', null, ''{"term": "Planted", "meaning": "Planted"}'')', pg_temp.id('pk'), pg_temp.id('invoicing')),
    format('select public.product_knowledge_approve(%L, gen_random_uuid())', pg_temp.id('pk')),
    format('select public.product_knowledge_reject(%L, gen_random_uuid())', pg_temp.id('pk')),
    format('select public.product_knowledge_of(%L, %L)', pg_temp.id('pk'), pg_temp.id('invoicing')),
    'select * from public.product_knowledge_owners',
    'select * from public.product_legal',
    'select * from public.product_glossary',
    'select * from public.product_knowledge_events',
    'select * from public.product_knowledge_proposals'
  ] loop perform pg_temp.refused(c, '42501'); end loop;
end $$;
reset role;

-- ── While Legal names nobody, the workspace's owners act as its owner ──
set local role authenticated;
do $$
declare
  n bigint;
  l public.product_legal;
  e public.product_knowledge_events;
  p public.product_knowledge_proposals;
begin
  -- Mia, a plain member, may only propose.
  perform pg_temp.as_('mia');
  perform pg_temp.refused(format('select public.product_legal_add(%L, %L, ''INVOICING'', ''Planted'', ''Planted'')', pg_temp.id('pk'), pg_temp.id('invoicing')), '42501');
  n := pg_temp.events();
  p := public.product_knowledge_propose(pg_temp.id('pk'), pg_temp.id('invoicing'), 'legal', 'add', null,
         '{"code": "VAT", "statement": "Every invoice shows the VAT rate it applies.", "source": "Belgian VAT Code, art. 53"}');
  e := pg_temp.one_event(n, 'proposed', 'legal');
  if p.state <> 'open' or p.action <> 'add' or p.proposed_by <> pg_temp.id('mia') or p.decided_by is not null
     or e.proposal_id <> p.id or e.changed_by <> pg_temp.id('mia') or e.before is not null
     or e.after->>'owner' <> pg_temp.id('mia')::text or e.after->>'code' <> 'VAT' then
    raise exception 'FAIL: a member''s proposal: % %', p, e;
  end if;
  insert into made values ('vat-proposal', p.id);
  if exists (select 1 from public.product_legal) then raise exception 'FAIL: a proposal added an entry before anyone approved it'; end if;
  perform pg_temp.refused(format('select public.product_knowledge_approve(%L, %L)', pg_temp.id('pk'), p.id), '42501');

  -- Owen, an owner of the workspace, adds directly and approves.
  perform pg_temp.as_('owen');
  n := pg_temp.events();
  l := public.product_legal_add(pg_temp.id('pk'), pg_temp.id('invoicing'), ' invoicing ',
         '  Invoice numbers follow each other with no gaps.  ', 'Belgian VAT Code, art. 53', pg_temp.id('lena'));
  e := pg_temp.one_event(n, 'added', 'legal');
  if l.code <> 'INVOICING' or l.number <> 1 or l.statement <> 'Invoice numbers follow each other with no gaps.'
     or l.source <> 'Belgian VAT Code, art. 53' or l.owner_id <> pg_temp.id('lena') or l.created_by <> pg_temp.id('owen')
     or l.retired_at is not null or e.legal_id <> l.id or e.before is not null
     or e.after <> jsonb_build_object('code', 'INVOICING', 'number', 1, 'statement', l.statement, 'source', l.source, 'owner', pg_temp.id('lena')) then
    raise exception 'FAIL: the first Legal entry is not L-INVOICING-1 with one `added` event: % %', l, e;
  end if;
  insert into made values ('inv-1', l.id);
  -- With no owner given, the entry is its writer's.
  l := public.product_legal_add(pg_temp.id('pk'), pg_temp.id('invoicing'), 'INVOICING', 'An invoice is never deleted.', 'Belgian VAT Code, art. 60');
  if l.number <> 2 or l.owner_id <> pg_temp.id('owen') then raise exception 'FAIL: the second INVOICING entry is not L-INVOICING-2, Owen''s: %', l; end if;
  insert into made values ('inv-2', l.id);

  n := pg_temp.events();
  p := public.product_knowledge_approve(pg_temp.id('pk'), pg_temp.made('vat-proposal'));
  e := pg_temp.one_event(n, 'approved', 'legal');
  l := pg_temp.legal(p.legal_id);
  if p.state <> 'approved' or p.decided_by <> pg_temp.id('owen') or p.decided_at is null
     or l.code <> 'VAT' or l.number <> 1 or l.owner_id <> pg_temp.id('mia') or l.created_by <> pg_temp.id('owen')
     or e.proposal_id <> p.id or e.legal_id <> l.id or e.before is not null or e.after->>'code' <> 'VAT' then
    raise exception 'FAIL: approving Mia''s proposal did not add L-VAT-1 with one `approved` event: % % %', p, l, e;
  end if;
  insert into made values ('vat-1', l.id);
  perform pg_temp.refused(format('select public.product_knowledge_approve(%L, %L)', pg_temp.id('pk'), p.id), 'P0002', 'proposal');
  perform pg_temp.refused(format('select public.product_knowledge_reject(%L, %L)', pg_temp.id('pk'), p.id), 'P0002', 'proposal');
end $$;
reset role;

-- ── Only a workspace owner names each kind's owner and delegate ──
set local role authenticated;
do $$
declare
  n bigint;
  e public.product_knowledge_events;
  got jsonb;
  stmt text;
begin
  foreach stmt in array array['mia', 'lena'] loop
    perform pg_temp.as_(stmt);
    perform pg_temp.refused(format('select public.product_knowledge_name(%L, %L, ''legal'', ''owner'', %L)', pg_temp.id('pk'), pg_temp.id('invoicing'), pg_temp.id('lena')), '42501');
  end loop;

  perform pg_temp.as_('owen');
  n := pg_temp.events();
  got := public.product_knowledge_name(pg_temp.id('pk'), pg_temp.id('invoicing'), 'legal', 'owner', pg_temp.id('lena'));
  e := pg_temp.one_event(n, 'named', 'legal');
  if got <> jsonb_build_object('kind', 'legal', 'role', 'owner', 'user', pg_temp.id('lena'), 'login', 'lena-gh')
     or e.before is not null or e.after <> jsonb_build_object('role', 'owner', 'user', pg_temp.id('lena'))
     or e.changed_by <> pg_temp.id('owen') or e.legal_id is not null or e.proposal_id is not null then
    raise exception 'FAIL: naming Lena the Legal owner: % %', got, e;
  end if;
  -- The same person again changes nothing and logs nothing.
  perform public.product_knowledge_name(pg_temp.id('pk'), pg_temp.id('invoicing'), 'legal', 'owner', pg_temp.id('lena'));
  if pg_temp.events() <> n + 1 then raise exception 'FAIL: naming the same owner again logged an event'; end if;

  n := pg_temp.events();
  perform public.product_knowledge_name(pg_temp.id('pk'), pg_temp.id('invoicing'), 'legal', 'delegate', pg_temp.id('gus'));
  perform pg_temp.one_event(n, 'named', 'legal');
  n := pg_temp.events();
  perform public.product_knowledge_name(pg_temp.id('pk'), pg_temp.id('invoicing'), 'legal', 'delegate', pg_temp.id('dan'));
  e := pg_temp.one_event(n, 'named', 'legal');
  if e.before <> jsonb_build_object('role', 'delegate', 'user', pg_temp.id('gus')) or e.after <> jsonb_build_object('role', 'delegate', 'user', pg_temp.id('dan')) then
    raise exception 'FAIL: changing the Legal delegate did not log before and after: %', e;
  end if;
  n := pg_temp.events();
  perform public.product_knowledge_name(pg_temp.id('pk'), pg_temp.id('invoicing'), 'glossary', 'owner', pg_temp.id('gus'));
  perform pg_temp.one_event(n, 'named', 'glossary');
  -- Lee will leave: naming then clearing a delegate.
  n := pg_temp.events();
  perform public.product_knowledge_name(pg_temp.id('pk'), pg_temp.id('invoicing'), 'glossary', 'delegate', pg_temp.id('lee'));
  perform pg_temp.one_event(n, 'named', 'glossary');
  n := pg_temp.events();
  got := public.product_knowledge_name(pg_temp.id('pk'), pg_temp.id('invoicing'), 'glossary', 'delegate', null);
  e := pg_temp.one_event(n, 'named', 'glossary');
  if got <> jsonb_build_object('kind', 'glossary', 'role', 'delegate', 'user', null, 'login', null) or e.after is not null
     or exists (select 1 from public.product_knowledge_owners o where o.kind = 'glossary' and o.role = 'delegate') then
    raise exception 'FAIL: clearing the Glossary delegate: % %', got, e;
  end if;

  -- Bad values: 22023, the field named.
  perform pg_temp.refused(format('select public.product_knowledge_name(%L, %L, ''legal'', ''owner'', %L)', pg_temp.id('pk'), pg_temp.id('invoicing'), pg_temp.id('carl')), '22023', 'user');
  perform pg_temp.refused(format('select public.product_knowledge_name(%L, %L, ''legal'', ''chief'', %L)', pg_temp.id('pk'), pg_temp.id('invoicing'), pg_temp.id('dan')), '22023', 'role');
  perform pg_temp.refused(format('select public.product_knowledge_name(%L, %L, ''law'', ''owner'', %L)', pg_temp.id('pk'), pg_temp.id('invoicing'), pg_temp.id('dan')), '22023', 'kind');
  perform pg_temp.refused(format('select public.product_knowledge_name(%L, %L, ''legal'', ''owner'', %L)', pg_temp.id('pk'), pg_temp.id('widgets'), pg_temp.id('dan')), 'P0002', 'product');
end $$;
reset role;

-- ── Once Legal names its owner, she and her delegate decide; the workspace owner only proposes ──
set local role authenticated;
do $$
declare
  n bigint;
  l public.product_legal;
  e public.product_knowledge_events;
  p public.product_knowledge_proposals;
  stmt text;
begin
  foreach stmt in array array['owen', 'gus', 'mia'] loop
    perform pg_temp.as_(stmt);
    perform pg_temp.refused(format('select public.product_legal_add(%L, %L, ''INVOICING'', ''Planted'', ''Planted'')', pg_temp.id('pk'), pg_temp.id('invoicing')), '42501');
    perform pg_temp.refused(format('select public.product_legal_edit(%L, %L, ''Planted'')', pg_temp.id('pk'), pg_temp.made('inv-1')), '42501');
    perform pg_temp.refused(format('select public.product_legal_retire(%L, %L)', pg_temp.id('pk'), pg_temp.made('inv-1')), '42501');
  end loop;

  -- Lena retires L-INVOICING-2: the row and its number stay, and the next INVOICING entry is 3.
  perform pg_temp.as_('lena');
  n := pg_temp.events();
  l := public.product_legal_retire(pg_temp.id('pk'), pg_temp.made('inv-2'));
  e := pg_temp.one_event(n, 'retired', 'legal');
  if l.retired_at is null or l.retired_by <> pg_temp.id('lena') or l.number <> 2 or e.legal_id <> l.id
     or e.after is not null or e.before->>'statement' <> 'An invoice is never deleted.' then
    raise exception 'FAIL: retiring L-INVOICING-2 did not keep it, with one `retired` event: % %', l, e;
  end if;
  if pg_temp.legal(pg_temp.made('inv-2')) is null then raise exception 'FAIL: a retired entry was deleted'; end if;
  perform pg_temp.refused(format('select public.product_legal_retire(%L, %L)', pg_temp.id('pk'), pg_temp.made('inv-2')), 'P0002', 'entry');
  perform pg_temp.refused(format('select public.product_legal_edit(%L, %L, ''Back'')', pg_temp.id('pk'), pg_temp.made('inv-2')), 'P0002', 'entry');

  -- Dan, the delegate, adds the next INVOICING entry: 3, never the retired 2.
  perform pg_temp.as_('dan');
  l := public.product_legal_add(pg_temp.id('pk'), pg_temp.id('invoicing'), 'INVOICING', 'An invoice keeps its date of issue.', 'Belgian VAT Code, art. 53');
  if l.number <> 3 then raise exception 'FAIL: the entry after a retirement reused a number: L-INVOICING-%', l.number; end if;
  insert into made values ('inv-3', l.id);
  -- Another code starts at 1, and so does the same code in another product.
  l := public.product_legal_add(pg_temp.id('pk'), pg_temp.id('invoicing'), 'GDPR2', 'Personal data leaves the EU only under a contract.', 'GDPR, art. 46');
  if l.code <> 'GDPR2' or l.number <> 1 then raise exception 'FAIL: a new code is not numbered from 1: %', l; end if;

  -- Edit: before and after; the same values again change nothing and log nothing.
  n := pg_temp.events();
  l := public.product_legal_edit(pg_temp.id('pk'), pg_temp.made('inv-1'), 'Invoice numbers follow each other with no gaps, per year.', null, pg_temp.id('dan'));
  e := pg_temp.one_event(n, 'edited', 'legal');
  if l.statement <> 'Invoice numbers follow each other with no gaps, per year.' or l.source <> 'Belgian VAT Code, art. 53'
     or l.owner_id <> pg_temp.id('dan') or l.code <> 'INVOICING' or l.number <> 1
     or e.before->>'statement' <> 'Invoice numbers follow each other with no gaps.' or e.before->>'owner' <> pg_temp.id('lena')::text
     or e.after->>'statement' <> l.statement or e.after->>'owner' <> pg_temp.id('dan')::text then
    raise exception 'FAIL: editing L-INVOICING-1 did not log one `edited` event with before and after: % %', l, e;
  end if;
  perform public.product_legal_edit(pg_temp.id('pk'), pg_temp.made('inv-1'), ' Invoice numbers follow each other with no gaps, per year. ', 'Belgian VAT Code, art. 53');
  if pg_temp.events() <> n + 1 then raise exception 'FAIL: an edit that changes nothing logged an event'; end if;

  -- Bad values: 22023, the field named, nothing stored.
  foreach stmt in array array[
    format('select public.product_legal_add(%L, %L, ''1NVOICING'', ''A'', ''B'')', pg_temp.id('pk'), pg_temp.id('invoicing')),
    format('select public.product_legal_add(%L, %L, ''IN VOICING'', ''A'', ''B'')', pg_temp.id('pk'), pg_temp.id('invoicing')),
    format('select public.product_legal_add(%L, %L, ''L-INVOICING'', ''A'', ''B'')', pg_temp.id('pk'), pg_temp.id('invoicing')),
    format('select public.product_legal_add(%L, %L, %L, ''A'', ''B'')', pg_temp.id('pk'), pg_temp.id('invoicing'), repeat('X', 41)),
    format('select public.product_legal_add(%L, %L, null, ''A'', ''B'')', pg_temp.id('pk'), pg_temp.id('invoicing'))
  ] loop perform pg_temp.refused(stmt, '22023', 'code'); end loop;
  perform pg_temp.refused(format('select public.product_legal_add(%L, %L, ''INVOICING'', %L, ''B'')', pg_temp.id('pk'), pg_temp.id('invoicing'), repeat('x', 401)), '22023', 'statement');
  perform pg_temp.refused(format('select public.product_legal_add(%L, %L, ''INVOICING'', %L, ''B'')', pg_temp.id('pk'), pg_temp.id('invoicing'), E'two\nlines'), '22023', 'statement');
  perform pg_temp.refused(format('select public.product_legal_add(%L, %L, ''INVOICING'', ''A'', ''  '')', pg_temp.id('pk'), pg_temp.id('invoicing')), '22023', 'source');
  perform pg_temp.refused(format('select public.product_legal_add(%L, %L, ''INVOICING'', ''A'', ''B'', %L)', pg_temp.id('pk'), pg_temp.id('invoicing'), pg_temp.id('carl')), '22023', 'owner');
  perform pg_temp.refused(format('select public.product_legal_edit(%L, %L)', pg_temp.id('pk'), pg_temp.made('inv-1')), '22023', 'fields');
  perform pg_temp.refused(format('select public.product_legal_add(%L, gen_random_uuid(), ''INVOICING'', ''A'', ''B'')', pg_temp.id('pk')), 'P0002', 'product');
  perform pg_temp.refused(format('select public.product_legal_edit(%L, gen_random_uuid(), ''A'')', pg_temp.id('pk')), 'P0002', 'entry');
  if exists (select 1 from public.product_legal x where x.statement in ('A', 'Planted')) then
    raise exception 'FAIL: a refused Legal entry was stored';
  end if;

  -- Payroll names nobody: Dan is nobody there, and Payroll numbers its own INVOICING entries.
  perform pg_temp.refused(format('select public.product_legal_add(%L, %L, ''INVOICING'', ''A'', ''B'')', pg_temp.id('pk'), pg_temp.id('payroll')), '42501');
  perform pg_temp.as_('owen');
  l := public.product_legal_add(pg_temp.id('pk'), pg_temp.id('payroll'), 'INVOICING', 'A payslip names its period.', 'Payroll Act, art. 4');
  if l.number <> 1 then raise exception 'FAIL: another product''s INVOICING entries are not numbered on their own: %', l; end if;
  insert into made values ('payroll-1', l.id);

  -- Mia proposes an edit of L-INVOICING-1 and the retirement of L-VAT-1; Dan, the delegate, approves both.
  perform pg_temp.as_('mia');
  p := public.product_knowledge_propose(pg_temp.id('pk'), pg_temp.id('invoicing'), 'legal', 'edit', pg_temp.made('inv-1'),
         '{"source": "Belgian VAT Code, art. 53, §2"}');
  insert into made values ('inv-1-edit', p.id);
  p := public.product_knowledge_propose(pg_temp.id('pk'), pg_temp.id('invoicing'), 'legal', 'retire', pg_temp.made('vat-1'), '{}');
  insert into made values ('vat-1-retire', p.id);
  perform pg_temp.refused(format('select public.product_knowledge_propose(%L, %L, ''legal'', ''edit'', %L, ''{"source": "x"}'')', pg_temp.id('pk'), pg_temp.id('invoicing'), pg_temp.made('inv-2')), 'P0002', 'entry');
  perform pg_temp.refused(format('select public.product_knowledge_propose(%L, %L, ''legal'', ''edit'', %L, ''{"source": "x"}'')', pg_temp.id('pk'), pg_temp.id('payroll'), pg_temp.made('inv-1')), 'P0002', 'entry');
  perform pg_temp.refused(format('select public.product_knowledge_propose(%L, %L, ''legal'', ''remove'', %L, ''{}'')', pg_temp.id('pk'), pg_temp.id('invoicing'), pg_temp.made('inv-1')), '22023', 'action');
  perform pg_temp.refused(format('select public.product_knowledge_propose(%L, %L, ''legal'', ''edit'', %L, ''{"code": "VAT"}'')', pg_temp.id('pk'), pg_temp.id('invoicing'), pg_temp.made('inv-1')), '22023', 'code');
  perform pg_temp.refused(format('select public.product_knowledge_propose(%L, %L, ''legal'', ''edit'', %L, ''{"colour": "red"}'')', pg_temp.id('pk'), pg_temp.id('invoicing'), pg_temp.made('inv-1')), '22023', 'colour');
  perform pg_temp.refused(format('select public.product_knowledge_propose(%L, %L, ''legal'', ''add'', %L, ''{"code": "VAT", "statement": "A", "source": "B"}'')', pg_temp.id('pk'), pg_temp.id('invoicing'), pg_temp.made('inv-1')), '22023', 'entry');
  perform pg_temp.refused(format('select public.product_knowledge_propose(%L, %L, ''legal'', ''add'', null, ''{"code": "VAT", "statement": "A"}'')', pg_temp.id('pk'), pg_temp.id('invoicing')), '22023', 'source');
  perform pg_temp.refused(format('select public.product_knowledge_propose(%L, %L, ''legal'', ''add'', null, ''{"code": "VAT", "statement": "A", "source": "B", "owner": "nobody"}'')', pg_temp.id('pk'), pg_temp.id('invoicing')), '22023', 'owner');
  perform pg_temp.refused(format('select public.product_knowledge_propose(%L, %L, ''legal'', ''add'', null, ''[1]'')', pg_temp.id('pk'), pg_temp.id('invoicing')), '22023', 'fields');

  -- Lena's Glossary rights are nobody's: Gus may not decide a Legal proposal, nor Owen any more.
  foreach stmt in array array['gus', 'owen', 'mia'] loop
    perform pg_temp.as_(stmt);
    perform pg_temp.refused(format('select public.product_knowledge_approve(%L, %L)', pg_temp.id('pk'), pg_temp.made('inv-1-edit')), '42501');
    perform pg_temp.refused(format('select public.product_knowledge_reject(%L, %L)', pg_temp.id('pk'), pg_temp.made('inv-1-edit')), '42501');
  end loop;

  perform pg_temp.as_('dan');
  n := pg_temp.events();
  p := public.product_knowledge_approve(pg_temp.id('pk'), pg_temp.made('inv-1-edit'));
  e := pg_temp.one_event(n, 'approved', 'legal');
  l := pg_temp.legal(pg_temp.made('inv-1'));
  if p.decided_by <> pg_temp.id('dan') or l.source <> 'Belgian VAT Code, art. 53, §2' or l.number <> 1
     or l.statement <> 'Invoice numbers follow each other with no gaps, per year.'
     or e.before->>'source' <> 'Belgian VAT Code, art. 53' or e.after->>'source' <> l.source or e.legal_id <> l.id then
    raise exception 'FAIL: approving the edit of L-INVOICING-1: % % %', p, l, e;
  end if;
  n := pg_temp.events();
  p := public.product_knowledge_approve(pg_temp.id('pk'), pg_temp.made('vat-1-retire'));
  e := pg_temp.one_event(n, 'approved', 'legal');
  if (pg_temp.legal(pg_temp.made('vat-1'))).retired_at is null or (pg_temp.legal(pg_temp.made('vat-1'))).retired_by <> pg_temp.id('dan')
     or e.after is not null then
    raise exception 'FAIL: approving the retirement of L-VAT-1 did not retire it: % %', pg_temp.legal(pg_temp.made('vat-1')), e;
  end if;
end $$;
reset role;

-- ── The glossary: Gus owns it; terms are unique without case, and a removed one is kept ──
set local role authenticated;
do $$
declare
  n bigint;
  g public.product_glossary;
  e public.product_knowledge_events;
  p public.product_knowledge_proposals;
  stmt text;
begin
  foreach stmt in array array['owen', 'lena', 'mia'] loop
    perform pg_temp.as_(stmt);
    perform pg_temp.refused(format('select public.product_glossary_add(%L, %L, ''Planted'', ''Planted'')', pg_temp.id('pk'), pg_temp.id('invoicing')), '42501');
  end loop;

  perform pg_temp.as_('gus');
  n := pg_temp.events();
  g := public.product_glossary_add(pg_temp.id('pk'), pg_temp.id('invoicing'), ' Credit note ',
         'A document that cancels all or part of an invoice.', array[' refund ', 'Refund', 'credit']);
  e := pg_temp.one_event(n, 'added', 'glossary');
  if g.term <> 'Credit note' or g.meaning <> 'A document that cancels all or part of an invoice.' or g.avoid <> array['refund', 'credit']
     or g.removed_at is not null or g.created_by <> pg_temp.id('gus') or e.glossary_id <> g.id or e.before is not null
     or e.after <> jsonb_build_object('term', 'Credit note', 'meaning', g.meaning, 'avoid', jsonb_build_array('refund', 'credit')) then
    raise exception 'FAIL: adding Credit note: % %', g, e;
  end if;
  insert into made values ('credit-note', g.id);
  g := public.product_glossary_add(pg_temp.id('pk'), pg_temp.id('invoicing'), 'Quote', 'A priced offer the customer may accept.');
  if g.avoid <> '{}'::text[] then raise exception 'FAIL: a term with no word to avoid: %', g; end if;
  insert into made values ('quote', g.id);

  perform pg_temp.refused(format('select public.product_glossary_add(%L, %L, ''credit NOTE'', ''Again'')', pg_temp.id('pk'), pg_temp.id('invoicing')), '22023', 'term');
  perform pg_temp.refused(format('select public.product_glossary_edit(%L, %L, ''CREDIT NOTE'')', pg_temp.id('pk'), pg_temp.made('quote')), '22023', 'term');
  perform pg_temp.refused(format('select public.product_glossary_add(%L, %L, %L, ''A'')', pg_temp.id('pk'), pg_temp.id('invoicing'), repeat('x', 81)), '22023', 'term');
  perform pg_temp.refused(format('select public.product_glossary_add(%L, %L, ''Term'', '''')', pg_temp.id('pk'), pg_temp.id('invoicing')), '22023', 'meaning');
  perform pg_temp.refused(format('select public.product_glossary_add(%L, %L, ''Term'', ''A'', array[''''])', pg_temp.id('pk'), pg_temp.id('invoicing')), '22023', 'avoid');
  perform pg_temp.refused(format('select public.product_glossary_add(%L, %L, ''Term'', ''A'', %L::text[])', pg_temp.id('pk'), pg_temp.id('invoicing'),
                                 (select array_agg('w' || i) from generate_series(1, 21) i)), '22023', 'avoid');
  -- The same word in another product is that product's own.
  perform pg_temp.as_('owen');
  perform public.product_glossary_add(pg_temp.id('pk'), pg_temp.id('payroll'), 'Credit note', 'A payroll correction.');

  -- Edit, with before and after; the same values change nothing.
  perform pg_temp.as_('gus');
  n := pg_temp.events();
  g := public.product_glossary_edit(pg_temp.id('pk'), pg_temp.made('quote'), 'Quotation', null, array['estimate']);
  e := pg_temp.one_event(n, 'edited', 'glossary');
  if g.term <> 'Quotation' or g.meaning <> 'A priced offer the customer may accept.' or g.avoid <> array['estimate']
     or e.before->>'term' <> 'Quote' or e.after->>'term' <> 'Quotation' then
    raise exception 'FAIL: editing Quote: % %', g, e;
  end if;
  perform public.product_glossary_edit(pg_temp.id('pk'), pg_temp.made('quote'), ' Quotation ', null, array['estimate']);
  if pg_temp.events() <> n + 1 then raise exception 'FAIL: a glossary edit that changes nothing logged an event'; end if;

  -- Remove: kept, marked removed; the same word may be added again.
  n := pg_temp.events();
  g := public.product_glossary_remove(pg_temp.id('pk'), pg_temp.made('credit-note'));
  e := pg_temp.one_event(n, 'removed', 'glossary');
  if g.removed_at is null or g.removed_by <> pg_temp.id('gus') or e.after is not null or e.before->>'term' <> 'Credit note' then
    raise exception 'FAIL: removing Credit note did not keep it, with one `removed` event: % %', g, e;
  end if;
  if pg_temp.term(pg_temp.made('credit-note')) is null then raise exception 'FAIL: a removed term was deleted'; end if;
  perform pg_temp.refused(format('select public.product_glossary_remove(%L, %L)', pg_temp.id('pk'), pg_temp.made('credit-note')), 'P0002', 'entry');
  perform pg_temp.refused(format('select public.product_glossary_edit(%L, %L, ''Back'')', pg_temp.id('pk'), pg_temp.made('credit-note')), 'P0002', 'entry');
  g := public.product_glossary_add(pg_temp.id('pk'), pg_temp.id('invoicing'), 'Credit Note', 'A document that cancels an invoice.', array['refund']);
  if g.id = pg_temp.made('credit-note') then raise exception 'FAIL: adding a removed word again brought back the removed row'; end if;
  insert into made values ('credit-note-2', g.id);

  -- A plain member proposes; nothing shows as a term until Gus approves; a rejection changes nothing.
  perform pg_temp.as_('mia');
  p := public.product_knowledge_propose(pg_temp.id('pk'), pg_temp.id('invoicing'), 'glossary', 'add', null,
         '{"term": "Invoice", "meaning": "A request for payment.", "avoid": ["bill"]}');
  insert into made values ('invoice-proposal', p.id);
  if exists (select 1 from public.product_glossary g2 where g2.term = 'Invoice') then
    raise exception 'FAIL: a proposed term shows before anyone approved it';
  end if;
  p := public.product_knowledge_propose(pg_temp.id('pk'), pg_temp.id('invoicing'), 'glossary', 'remove', pg_temp.made('quote'), '{}');
  insert into made values ('quote-remove', p.id);
  perform pg_temp.refused(format('select public.product_knowledge_propose(%L, %L, ''glossary'', ''add'', null, ''{"term": "credit note", "meaning": "A"}'')', pg_temp.id('pk'), pg_temp.id('invoicing')), '22023', 'term');
  perform pg_temp.refused(format('select public.product_knowledge_propose(%L, %L, ''glossary'', ''retire'', %L, ''{}'')', pg_temp.id('pk'), pg_temp.id('invoicing'), pg_temp.made('quote')), '22023', 'action');
  perform pg_temp.refused(format('select public.product_knowledge_propose(%L, %L, ''glossary'', ''edit'', %L, ''{"meaning": "x"}'')', pg_temp.id('pk'), pg_temp.id('invoicing'), pg_temp.made('credit-note')), 'P0002', 'entry');
  perform pg_temp.refused(format('select public.product_knowledge_propose(%L, %L, ''glossary'', ''add'', null, ''{"term": "X", "meaning": "Y", "avoid": "bill"}'')', pg_temp.id('pk'), pg_temp.id('invoicing')), '22023', 'avoid');

  foreach stmt in array array['owen', 'lena', 'mia'] loop
    perform pg_temp.as_(stmt);
    perform pg_temp.refused(format('select public.product_knowledge_approve(%L, %L)', pg_temp.id('pk'), pg_temp.made('invoice-proposal')), '42501');
  end loop;

  perform pg_temp.as_('gus');
  n := pg_temp.events();
  p := public.product_knowledge_approve(pg_temp.id('pk'), pg_temp.made('invoice-proposal'));
  e := pg_temp.one_event(n, 'approved', 'glossary');
  g := pg_temp.term(p.glossary_id);
  if p.state <> 'approved' or p.decided_by <> pg_temp.id('gus') or g.term <> 'Invoice' or g.avoid <> array['bill']
     or e.glossary_id <> g.id or e.proposal_id <> p.id then
    raise exception 'FAIL: approving Invoice: % % %', p, g, e;
  end if;
  n := pg_temp.events();
  p := public.product_knowledge_reject(pg_temp.id('pk'), pg_temp.made('quote-remove'));
  e := pg_temp.one_event(n, 'rejected', 'glossary');
  if p.state <> 'rejected' or p.decided_by <> pg_temp.id('gus') or p.decided_at is null
     or (pg_temp.term(pg_temp.made('quote'))).removed_at is not null or e.proposal_id <> p.id or e.glossary_id <> pg_temp.made('quote') then
    raise exception 'FAIL: rejecting the removal of Quotation: % %', p, e;
  end if;
  -- The rejection touched only the proposal and appended its event.
  if (select count(*) from public.product_glossary) <> 5 or pg_temp.proposal(pg_temp.made('quote-remove')) is null then
    raise exception 'FAIL: a rejected proposal changed the glossary';
  end if;
end $$;
reset role;

-- ── A named owner who left the workspace names nobody: the workspace's owners decide again ──
set local role authenticated;
do $$
begin
  perform pg_temp.as_('owen');
  perform public.product_knowledge_name(pg_temp.id('pk'), pg_temp.id('payroll'), 'glossary', 'owner', pg_temp.id('lee'));
end $$;
reset role;
delete from public.workspace_members where user_id = '00000000-0000-4000-8000-0000001795a6';
set local role authenticated;
do $$
begin
  perform pg_temp.as_('owen');
  perform public.product_glossary_add(pg_temp.id('pk'), pg_temp.id('payroll'), 'Payslip', 'A worker''s monthly statement.');
  perform pg_temp.as_('lee');
  perform pg_temp.refused(format('select public.product_glossary_add(%L, %L, ''Bonus'', ''Extra pay.'')', pg_temp.id('pk'), pg_temp.id('payroll')), '42501');
end $$;
reset role;

-- Every change above ran in this one transaction, so each entry's created and updated times are the same
-- now(): L-INVOICING-1 is given distinct ones, to tell them apart in the read. L-GDPR2-1 and Quotation lose
-- their author, as `on delete set null` leaves an entry whose author's account was deleted (PRD 2240 s1).
update public.product_legal set created_at = '2026-01-05 09:00+00', updated_at = '2026-02-07 10:30+00' where id = pg_temp.made('inv-1');
update public.product_legal set created_by = null where code = 'GDPR2';
update public.product_glossary set created_by = null where id = pg_temp.made('quote');

-- ── The page's read: owners, entries and the open proposals, with what the reader may do ──
set local role authenticated;
do $$
declare got jsonb;
begin
  perform pg_temp.as_('mia');
  perform public.product_knowledge_propose(pg_temp.id('pk'), pg_temp.id('invoicing'), 'legal', 'add', null,
            '{"code": "INVOICING", "statement": "An invoice states its due date.", "source": "Belgian VAT Code, art. 53"}');
  got := public.product_knowledge_of(pg_temp.id('pk'), pg_temp.id('invoicing'));
  if got->'product' <> jsonb_build_object('id', pg_temp.id('invoicing'), 'name', 'Invoicing') or (got->>'canName')::boolean then
    raise exception 'FAIL: the page read''s product, for a member: %', got;
  end if;
  if got->'legal'->'owner' <> jsonb_build_object('user', pg_temp.id('lena'), 'login', 'lena-gh')
     or got->'legal'->'delegate' <> jsonb_build_object('user', pg_temp.id('dan'), 'login', 'dan@pk.test')
     or (got->'legal'->>'decides')::boolean
     or got->'glossary'->'owner'->>'login' <> 'gus@pk.test' or got->'glossary'->'delegate' <> 'null'::jsonb then
    raise exception 'FAIL: the page read''s owners and delegates: % %', got->'legal', got->'glossary';
  end if;
  if (select string_agg(x->>'id', ',') from jsonb_array_elements(got->'legal'->'entries') x)
     <> 'L-GDPR2-1,L-INVOICING-1,L-INVOICING-2,L-INVOICING-3,L-VAT-1'
     or (select count(*) from jsonb_array_elements(got->'legal'->'entries') x where x->>'retiredAt' is not null) <> 2
     or got->'legal'->'entries'->1->'owner'->>'login' <> 'dan@pk.test'
     or got->'legal'->'entries'->1->>'entry' <> pg_temp.made('inv-1')::text then
    raise exception 'FAIL: the page read''s Legal entries: %', got->'legal'->'entries';
  end if;
  if (select string_agg(x->>'term', ',') from jsonb_array_elements(got->'glossary'->'entries') x) <> 'Credit Note,Credit note,Invoice,Quotation'
     or (select count(*) from jsonb_array_elements(got->'glossary'->'entries') x where x->>'removedAt' is not null) <> 1 then
    raise exception 'FAIL: the page read''s glossary: %', got->'glossary'->'entries';
  end if;
  -- Who added each entry, and when (PRD 2240 s1): L-INVOICING-1 by Owen, the Legal entry by approval by
  -- its approver, a term by Gus; an entry whose author is gone names nobody, and still has its dates.
  if got->'legal'->'entries'->1->'createdBy' is distinct from jsonb_build_object('user', pg_temp.id('owen'), 'login', 'owen@pk.test')
     or got->'legal'->'entries'->1->'createdAt' is distinct from to_jsonb('2026-01-05 09:00+00'::timestamptz)
     or got->'legal'->'entries'->1->'updatedAt' is distinct from to_jsonb('2026-02-07 10:30+00'::timestamptz)
     or got->'legal'->'entries'->4->'createdBy'->>'user' is distinct from pg_temp.id('owen')::text
     or got->'legal'->'entries'->0->'createdBy' is distinct from 'null'::jsonb
     or got->'legal'->'entries'->0->'createdAt' is distinct from to_jsonb((pg_temp.legal((got->'legal'->'entries'->0->>'entry')::uuid)).created_at)
     or got->'legal'->'entries'->0->'updatedAt' is distinct from to_jsonb((pg_temp.legal((got->'legal'->'entries'->0->>'entry')::uuid)).updated_at) then
    raise exception 'FAIL: the page read''s Legal authors and dates: %', got->'legal'->'entries';
  end if;
  if got->'glossary'->'entries'->2->'createdBy' is distinct from jsonb_build_object('user', pg_temp.id('gus'), 'login', 'gus@pk.test')
     or got->'glossary'->'entries'->3->'createdBy' is distinct from 'null'::jsonb
     or got->'glossary'->'entries'->3->'createdAt' is distinct from to_jsonb((pg_temp.term(pg_temp.made('quote'))).created_at)
     or got->'glossary'->'entries'->3->'updatedAt' is distinct from to_jsonb((pg_temp.term(pg_temp.made('quote'))).updated_at)
     or got->'glossary'->'entries'->2->'createdAt' is null or got->'glossary'->'entries'->2->'updatedAt' is null then
    raise exception 'FAIL: the page read''s glossary authors and dates: %', got->'glossary'->'entries';
  end if;
  if jsonb_array_length(got->'legal'->'proposals') <> 1 or jsonb_array_length(got->'glossary'->'proposals') <> 0
     or got->'legal'->'proposals'->0->>'action' <> 'add' or got->'legal'->'proposals'->0->'proposedBy'->>'login' <> 'mia@pk.test'
     or got->'legal'->'proposals'->0->'fields'->>'statement' <> 'An invoice states its due date.' then
    raise exception 'FAIL: the page read''s open proposals: % %', got->'legal'->'proposals', got->'glossary'->'proposals';
  end if;
  if got->>'latestEventId' <> (select max(e.id)::text from public.product_knowledge_events e where e.product_id = pg_temp.id('invoicing')) then
    raise exception 'FAIL: the page read''s newest event: %', got->>'latestEventId';
  end if;
  perform pg_temp.as_('lena');
  got := public.product_knowledge_of(pg_temp.id('pk'), pg_temp.id('invoicing'));
  if not (got->'legal'->>'decides')::boolean or (got->'glossary'->>'decides')::boolean or (got->>'canName')::boolean then
    raise exception 'FAIL: what the Legal owner may do: %', got;
  end if;
  perform pg_temp.as_('owen');
  got := public.product_knowledge_of(pg_temp.id('pk'), pg_temp.id('invoicing'));
  if not (got->>'canName')::boolean or (got->'legal'->>'decides')::boolean then
    raise exception 'FAIL: what the workspace owner may do once Legal names its owner: %', got;
  end if;
  got := public.product_knowledge_of(pg_temp.id('pk'), pg_temp.id('payroll'));
  if not (got->'legal'->>'decides')::boolean or got->'legal'->'owner' <> 'null'::jsonb or got->'glossary'->'owner' <> 'null'::jsonb then
    raise exception 'FAIL: a workspace owner decides a kind that names nobody (Payroll): %', got;
  end if;
end $$;
reset role;

-- ── A member reads all five tables, and nobody writes one directly ──
create temporary table before_refusals as select pg_temp.store() as s;
grant select on before_refusals to anon, authenticated, service_role;
set local role authenticated;
do $$
declare
  c text;
  person text;
begin
  perform pg_temp.as_('mia');
  if (select count(*) from public.product_knowledge_owners) <> 4 or (select count(*) from public.product_legal) <> 6
     or (select count(*) from public.product_glossary) <> 6 or (select count(*) from public.product_knowledge_proposals) <> 6
     or (select count(*) from public.product_knowledge_events) <> pg_temp.events() then
    raise exception 'FAIL: a member does not read every row of their workspace''s knowledge: % % % % %',
      (select count(*) from public.product_knowledge_owners), (select count(*) from public.product_legal),
      (select count(*) from public.product_glossary), (select count(*) from public.product_knowledge_proposals),
      (select count(*) from public.product_knowledge_events);
  end if;
  foreach person in array array['mia', 'owen', 'lena'] loop
    perform pg_temp.as_(person);
    foreach c in array array[
      format('insert into public.product_legal (workspace_id, product_id, code, number, statement, source) values (%L, %L, ''X'', 9, ''A'', ''B'')', pg_temp.id('pk'), pg_temp.id('invoicing')),
      format('update public.product_legal set number = 2 where id = %L', pg_temp.made('inv-3')),
      'delete from public.product_legal',
      format('insert into public.product_glossary (workspace_id, product_id, term, meaning) values (%L, %L, ''X'', ''Y'')', pg_temp.id('pk'), pg_temp.id('invoicing')),
      'update public.product_glossary set removed_at = null',
      'delete from public.product_glossary',
      format('insert into public.product_knowledge_owners (workspace_id, product_id, kind, role, user_id) values (%L, %L, ''legal'', ''owner'', %L)', pg_temp.id('pk'), pg_temp.id('payroll'), pg_temp.id('mia')),
      'update public.product_knowledge_owners set user_id = user_id',
      'delete from public.product_knowledge_owners',
      'update public.product_knowledge_proposals set state = ''approved''',
      'delete from public.product_knowledge_proposals',
      'update public.product_knowledge_events set after = null',
      'delete from public.product_knowledge_events'
    ] loop perform pg_temp.refused(c, '42501'); end loop;
  end loop;
end $$;
reset role;

-- ── Another workspace's owner and a stranger: refused, and they read nothing ──
set local role authenticated;
do $$
declare
  person text;
  c text;
begin
  foreach person in array array['carl', 'sam'] loop
    perform pg_temp.as_(person);
    foreach c in array array[
      format('select public.product_knowledge_name(%L, %L, ''legal'', ''owner'', %L)', pg_temp.id('pk'), pg_temp.id('invoicing'), pg_temp.id(person)),
      format('select public.product_legal_add(%L, %L, ''INVOICING'', ''Planted'', ''Planted'')', pg_temp.id('pk'), pg_temp.id('invoicing')),
      format('select public.product_legal_edit(%L, %L, ''Planted'')', pg_temp.id('pk'), pg_temp.made('inv-1')),
      format('select public.product_legal_retire(%L, %L)', pg_temp.id('pk'), pg_temp.made('inv-1')),
      format('select public.product_glossary_add(%L, %L, ''Planted'', ''Planted'')', pg_temp.id('pk'), pg_temp.id('invoicing')),
      format('select public.product_glossary_edit(%L, %L, ''Planted'')', pg_temp.id('pk'), pg_temp.made('quote')),
      format('select public.product_glossary_remove(%L, %L)', pg_temp.id('pk'), pg_temp.made('quote')),
      format('select public.product_knowledge_propose(%L, %L, ''glossary'', ''add'', null, ''{"term": "Planted", "meaning": "Planted"}'')', pg_temp.id('pk'), pg_temp.id('invoicing')),
      format('select public.product_knowledge_approve(%L, %L)', pg_temp.id('pk'), pg_temp.made('inv-1-edit')),
      format('select public.product_knowledge_reject(%L, %L)', pg_temp.id('pk'), pg_temp.made('inv-1-edit')),
      format('select public.product_knowledge_of(%L, %L)', pg_temp.id('pk'), pg_temp.id('invoicing'))
    ] loop perform pg_temp.refused(c, '42501'); end loop;
    if exists (select 1 from public.product_knowledge_owners) or exists (select 1 from public.product_legal)
       or exists (select 1 from public.product_glossary) or exists (select 1 from public.product_knowledge_events)
       or exists (select 1 from public.product_knowledge_proposals) then
      raise exception 'FAIL: % reads PK''s product knowledge', person;
    end if;
  end loop;
  -- Carl owns Other, so he passes its checks, but PK's products and entries are not Other's.
  perform pg_temp.as_('carl');
  perform pg_temp.refused(format('select public.product_legal_add(%L, %L, ''INVOICING'', ''Planted'', ''Planted'')', pg_temp.id('other'), pg_temp.id('invoicing')), 'P0002', 'product');
  perform pg_temp.refused(format('select public.product_legal_edit(%L, %L, ''Planted'')', pg_temp.id('other'), pg_temp.made('inv-1')), 'P0002', 'entry');
  perform pg_temp.refused(format('select public.product_glossary_remove(%L, %L)', pg_temp.id('other'), pg_temp.made('quote')), 'P0002', 'entry');
  perform pg_temp.refused(format('select public.product_knowledge_propose(%L, %L, ''legal'', ''retire'', %L, ''{}'')', pg_temp.id('other'), pg_temp.id('widgets'), pg_temp.made('inv-1')), 'P0002', 'entry');
  perform pg_temp.refused(format('select public.product_knowledge_approve(%L, %L)', pg_temp.id('other'), pg_temp.made('inv-1-edit')), 'P0002', 'proposal');
  perform pg_temp.refused(format('select public.product_knowledge_of(%L, %L)', pg_temp.id('other'), pg_temp.id('invoicing')), 'P0002', 'product');
  perform pg_temp.refused(format('select public.product_knowledge_name(%L, %L, ''legal'', ''owner'', %L)', pg_temp.id('other'), pg_temp.id('invoicing'), pg_temp.id('carl')), 'P0002', 'product');
end $$;
reset role;

-- ── The service role writes nothing directly either, and nobody rewrites an event ──
set local role service_role;
do $$
declare c text;
begin
  foreach c in array array[
    format('insert into public.product_legal (workspace_id, product_id, code, number, statement, source) values (%L, %L, ''X'', 9, ''A'', ''B'')', pg_temp.id('pk'), pg_temp.id('invoicing')),
    'update public.product_legal set retired_at = null',
    'delete from public.product_glossary',
    'delete from public.product_knowledge_owners',
    'update public.product_knowledge_proposals set state = ''open''',
    format('insert into public.product_knowledge_events (workspace_id, product_id, kind, action) values (%L, %L, ''legal'', ''added'')', pg_temp.id('pk'), pg_temp.id('invoicing')),
    'update public.product_knowledge_events set after = null',
    'delete from public.product_knowledge_events',
    format('select public.product_legal_add(%L, %L, ''INVOICING'', ''Planted'', ''Planted'')', pg_temp.id('pk'), pg_temp.id('invoicing')),
    format('select public.product_knowledge_apply((select p from public.products p where p.id = %L), ''legal'', ''retire'', %L, ''{}'', null)', pg_temp.id('invoicing'), pg_temp.made('inv-1'))
  ] loop perform pg_temp.refused(c, '42501'); end loop;
end $$;
reset role;

do $$
begin
  if pg_temp.store() <> (select s from before_refusals) then
    raise exception 'FAIL: a refused call changed the product knowledge';
  end if;
end $$;

-- ── Every change left exactly one event, and every event is a change ──
do $$
declare
  counted bigint;
begin
  -- One event per direct change: 5 Legal entries added (L-VAT-1 came by approval), one edited (the
  -- edit that changed nothing logged none), one retired; 5 terms added (Invoice came by approval), one
  -- edited, one removed.
  select count(*) into counted from public.product_knowledge_events e where e.action in ('added', 'edited', 'retired', 'removed');
  if counted <> 5 + 1 + 1 + 5 + 1 + 1 then
    raise exception 'FAIL: % entry events, not one per direct change', counted;
  end if;
  if (select count(*) from public.product_knowledge_events e where e.action = 'proposed') <> (select count(*) from public.product_knowledge_proposals)
     or (select count(*) from public.product_knowledge_events e where e.action in ('approved', 'rejected'))
        <> (select count(*) from public.product_knowledge_proposals p where p.state <> 'open') then
    raise exception 'FAIL: a proposal or a decision does not have exactly one event';
  end if;
end $$;

rollback;

\echo 'product_knowledge: every check passed'
