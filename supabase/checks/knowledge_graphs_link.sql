-- What an agent's link reads of its product's knowledge graph (PRD 1798 s4,
-- 20261216090000_knowledge_graph_for_token.sql). The supabase workflow runs it on every pull request,
-- after `supabase db start` has applied the migrations and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/knowledge_graphs_link.sql
-- knowledge_graph_for_token() answers, for anyone holding a live business link, the link's own product
-- (the repository's only product, or the business's only one without a repository) with its links, every
-- Legal entry, Glossary term and Never line (retired and removed ones flagged), and the latest graph of
-- each link serving its own knowledge: never one of an imported link, never another workspace's. A
-- revoked link, an unknown one, a kit token and the link of a maker who left read nothing (28000); another
-- workspace's repository is refused, named (42501); a malformed repository, one in no product and a
-- business with several products and no repository named are refused in one line (22023). `last used`
-- moves. Nothing is written but that.
-- One transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

-- ── The cast ──
-- Ada and Leo belong to KG Link, Carl to KG Other; Kim to KG Empty, which sells nothing yet.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000017984a1', 'ada@kglink.test'),
  ('00000000-0000-4000-8000-0000017984a2', 'leo@kglink.test'),
  ('00000000-0000-4000-8000-0000017984c1', 'carl@kgother.test'),
  ('00000000-0000-4000-8000-0000017984e1', 'kim@kgempty.test');
insert into public.workspaces (slug, name, github_org) values
  ('kg-link', 'KG Link', 'kglink'), ('kg-other', 'KG Other', 'kgother'), ('kg-empty', 'KG Empty', 'kgempty');
insert into public.workspace_members (workspace_id, user_id)
select w.id, m.user_id
  from (values ('kg-link', '00000000-0000-4000-8000-0000017984a1'::uuid),
               ('kg-link', '00000000-0000-4000-8000-0000017984a2'::uuid),
               ('kg-other', '00000000-0000-4000-8000-0000017984c1'::uuid),
               ('kg-empty', '00000000-0000-4000-8000-0000017984e1'::uuid)) as m (slug, user_id)
  join public.workspaces w on w.slug = m.slug;
insert into public.businesses (workspace_id, name)
select w.id, w.name from public.workspaces w where w.slug in ('kg-link', 'kg-other', 'kg-empty');
insert into public.products (workspace_id, business_id, name, key)
select b.workspace_id, b.id, x.name, x.key
  from (values ('kg-link', 'Link Web', 'link-web'), ('kg-other', 'Other App', 'other-app')) as x (slug, name, key)
  join public.workspaces w on w.slug = x.slug
  join public.businesses b on b.workspace_id = w.id;

-- KG Link lists kglink/front and kglink/back (its own knowledge), kglink/docs (imported) and kglink/loose
-- (in no product). KG Other lists kgother/api and kglink/front too, both in Other App.
insert into public.repositories (workspace_id, full_name)
select w.id, r.name
  from (values ('kg-link', 'kglink/front'), ('kg-link', 'kglink/back'), ('kg-link', 'kglink/docs'), ('kg-link', 'kglink/loose'),
               ('kg-other', 'kgother/api'), ('kg-other', 'kglink/front')) as r (slug, name)
  join public.workspaces w on w.slug = r.slug;
insert into public.product_repositories (product_id, workspace_id, repository, knowledge, read_at, added_by)
select p.id, p.workspace_id, x.repository, x.knowledge, case when x.knowledge = 'imported' then repeat('d', 40) end, 'person'
  from (values ('link-web', 'kglink/front', 'own'), ('link-web', 'kglink/back', 'own'), ('link-web', 'kglink/docs', 'imported'),
               ('other-app', 'kgother/api', 'own'), ('other-app', 'kglink/front', 'own')) as x (key, repository, knowledge)
  join public.products p on p.key = x.key;

-- Link Web's Legal entries (one retired), terms (one removed) and Never lines (one removed); Other App's own.
insert into public.product_legal (workspace_id, product_id, code, number, statement, source, retired_at)
select p.workspace_id, p.id, x.code, x.number, x.statement, 'https://law.example/vat', x.retired::timestamptz
  from (values ('link-web', 'INVOICING', 1, 'An invoice keeps its number.', null),
               ('link-web', 'INVOICING', 2, 'An invoice is sent within a week.', '2026-10-01T00:00:00Z'),
               ('other-app', 'PRIVACY', 1, 'Other App keeps no address.', null)) as x (key, code, number, statement, retired)
  join public.products p on p.key = x.key;
insert into public.product_glossary (workspace_id, product_id, term, meaning, removed_at)
select p.workspace_id, p.id, x.term, x.meaning, x.removed::timestamptz
  from (values ('link-web', 'Credit note', 'A document that cancels an invoice.', null),
               ('link-web', 'Refund', 'Money sent back.', '2026-10-02T00:00:00Z'),
               ('other-app', 'Ticket', 'A request from a customer.', null)) as x (key, term, meaning, removed)
  join public.products p on p.key = x.key;
insert into public.constituents (workspace_id, product_id, kind, seq, body, removed_at)
select p.workspace_id, p.id, 'never', x.seq, x.body, x.removed::timestamptz
  from (values ('link-web', 1, 'Never sell the data.', null),
               ('link-web', 2, 'Never build for groups.', '2026-10-03T00:00:00Z'),
               ('other-app', 1, 'Never call a customer.', null)) as x (key, seq, body, removed)
  join public.products p on p.key = x.key;

-- A repository's graph, one rule labelled `label`.
create function pg_temp.graph(label text) returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'version', 1, 'shape', 'repository',
    'nodes', jsonb_build_array(jsonb_build_object('id', 'BR-PRODUCT-3', 'kind', 'rule', 'label', label, 'status', 'law',
                                                  'file', '.omni-loop/knowledge/product/rules.md', 'origin', 'repository')),
    'edges', jsonb_build_array(jsonb_build_object('from', 'BR-PRODUCT-3', 'to', 'L-INVOICING-1', 'kind', 'serves')));
$$;
-- kglink/front at commit a, then b (the latest); kglink/docs (imported) and kgother/api pushed; kglink/back never.
insert into public.knowledge_graphs (repository, sha, graph, pushed_at, pushed_by, pushed_by_login) values
  ('kglink/front', repeat('a', 40), pg_temp.graph('front at a'), '2026-10-10T10:00:00Z', '00000000-0000-4000-8000-0000017984a1', 'ada-gh'),
  ('kglink/front', repeat('b', 40), pg_temp.graph('front at b'), '2026-10-12T10:00:00Z', '00000000-0000-4000-8000-0000017984a1', 'ada-gh'),
  ('kglink/docs', repeat('c', 40), pg_temp.graph('docs'), '2026-10-12T11:00:00Z', null, null),
  ('kgother/api', repeat('e', 40), pg_temp.graph('other api'), '2026-10-12T12:00:00Z', '00000000-0000-4000-8000-0000017984c1', 'carl-gh');

create function pg_temp.hash(token text) returns text language sql immutable as $$
  select encode(sha256(convert_to(token, 'UTF8')), 'hex');
$$;
-- Ada's live link, her revoked one and her kit token; Leo's link (he leaves below); Carl's; Kim's.
insert into public.agent_tokens (workspace_id, made_by, name, token_hash, last_four, scope, expires_at, revoked_at)
select w.id, x.made_by::uuid, x.name, pg_temp.hash(x.token), right(x.token, 4), x.scope,
       case when x.scope = 'kit' then now() + interval '30 days' end, x.revoked::timestamptz
  from (values ('kg-link', '00000000-0000-4000-8000-0000017984a1', 'ada live', 'omb_kglink_ada_0001', 'business', null),
               ('kg-link', '00000000-0000-4000-8000-0000017984a1', 'ada revoked', 'omb_kglink_ada_0002', 'business', '2026-10-01T00:00:00Z'),
               ('kg-link', '00000000-0000-4000-8000-0000017984a1', 'ada kit', 'omk_kglink_ada_0003', 'kit', null),
               ('kg-link', '00000000-0000-4000-8000-0000017984a2', 'leo live', 'omb_kglink_leo_0004', 'business', null),
               ('kg-other', '00000000-0000-4000-8000-0000017984c1', 'carl live', 'omb_kgother_carl_0005', 'business', null),
               ('kg-empty', '00000000-0000-4000-8000-0000017984e1', 'kim live', 'omb_kgempty_kim_0006', 'business', null))
       as x (slug, made_by, name, token, scope, revoked)
  join public.workspaces w on w.slug = x.slug;
delete from public.workspace_members m
 where m.user_id = '00000000-0000-4000-8000-0000017984a2' and m.workspace_id = (select w.id from public.workspaces w where w.slug = 'kg-link');

create function pg_temp.sign_out() returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
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
-- The read of `token`'s link for `repo`.
create function pg_temp.read(token text, repo text default null) returns jsonb language sql as $$
  select public.knowledge_graph_for_token(pg_temp.hash(token), repo);
$$;
grant execute on function pg_temp.read(text, text) to anon;

-- ── Who may call it ──
do $$
begin
  if not has_function_privilege('anon', 'public.knowledge_graph_for_token(text, text)', 'execute')
     or not has_function_privilege('authenticated', 'public.knowledge_graph_for_token(text, text)', 'execute') then
    raise exception 'FAIL: a link''s holder cannot call knowledge_graph_for_token()';
  end if;
  if not (select p.prosecdef from pg_proc p where p.oid = 'public.knowledge_graph_for_token(text, text)'::regprocedure) then
    raise exception 'FAIL: knowledge_graph_for_token() is not security definer';
  end if;
end $$;

-- ── Ada's link, signed out: its own product, whole ──
select pg_temp.sign_out();
set local role anon;
do $$
declare
  body jsonb := pg_temp.read('omb_kglink_ada_0001', 'kglink/front');
begin
  if body -> 'product' ->> 'key' <> 'link-web' or body -> 'product' ->> 'name' <> 'Link Web' or body -> 'product' ->> 'id' is null then
    raise exception 'FAIL: the link did not read its product: %', body -> 'product';
  end if;
  if body -> 'links' <> '[{"repository": "kglink/back", "knowledge": "own"}, {"repository": "kglink/docs", "knowledge": "imported"}, {"repository": "kglink/front", "knowledge": "own"}]'::jsonb then
    raise exception 'FAIL: the link did not read the product''s links, by repository: %', body -> 'links';
  end if;
  if body -> 'legal' <> '[{"code": "INVOICING", "number": 1, "statement": "An invoice keeps its number.", "retired_at": null},
                          {"code": "INVOICING", "number": 2, "statement": "An invoice is sent within a week.", "retired_at": "2026-10-01T00:00:00+00:00"}]'::jsonb then
    raise exception 'FAIL: the link did not read every Legal entry of its product, retired flagged: %', body -> 'legal';
  end if;
  if body -> 'glossary' <> '[{"term": "Credit note", "meaning": "A document that cancels an invoice.", "removed_at": null},
                             {"term": "Refund", "meaning": "Money sent back.", "removed_at": "2026-10-02T00:00:00+00:00"}]'::jsonb then
    raise exception 'FAIL: the link did not read every term of its product, removed flagged: %', body -> 'glossary';
  end if;
  if body -> 'never' <> '[{"seq": 1, "body": "Never sell the data.", "removed_at": null},
                          {"seq": 2, "body": "Never build for groups.", "removed_at": "2026-10-03T00:00:00+00:00"}]'::jsonb then
    raise exception 'FAIL: the link did not read every Never line of its product, removed flagged: %', body -> 'never';
  end if;
  -- The latest graph of each own link: kglink/front at b; kglink/back never pushed; kglink/docs is imported.
  if jsonb_array_length(body -> 'graphs') <> 1 or body -> 'graphs' -> 0 ->> 'repository' <> 'kglink/front'
     or body -> 'graphs' -> 0 ->> 'sha' <> repeat('b', 40) or body -> 'graphs' -> 0 -> 'graph' <> pg_temp.graph('front at b')
     or body -> 'graphs' -> 0 ->> 'pushed_by_login' <> 'ada-gh' or (body -> 'graphs' -> 0 ->> 'pushed_at')::timestamptz <> '2026-10-12T10:00:00Z' then
    raise exception 'FAIL: the link did not read the latest graph of its own-knowledge repositories alone: %', body -> 'graphs';
  end if;
  -- Any of its repositories, in any case, and none, read the same product.
  if pg_temp.read('omb_kglink_ada_0001', ' KGLink/Back ') <> body or pg_temp.read('omb_kglink_ada_0001') <> body then
    raise exception 'FAIL: the link read another body for another of its repositories, or for none';
  end if;
  -- A repository its GitHub organisation owns but its workspace does not list is in no product of it.
  perform pg_temp.refused($q$select pg_temp.read('omb_kglink_ada_0001', 'kglink/unlisted')$q$, '22023', 'an unlisted repository of its organisation', 'not in exactly one product');
end $$;

-- ── Never another workspace's ──
do $$
declare
  body jsonb := pg_temp.read('omb_kgother_carl_0005');
begin
  -- Carl's link reads Other App: its own Legal, term and Never line, and its two graphs, kglink/front's latest among them.
  if body -> 'product' ->> 'key' <> 'other-app' or body -> 'legal' -> 0 ->> 'code' <> 'PRIVACY' or jsonb_array_length(body -> 'legal') <> 1
     or body -> 'glossary' -> 0 ->> 'term' <> 'Ticket' or jsonb_array_length(body -> 'glossary') <> 1
     or body -> 'never' -> 0 ->> 'body' <> 'Never call a customer.' or jsonb_array_length(body -> 'never') <> 1 then
    raise exception 'FAIL: Carl''s link did not read Other App''s own knowledge alone: %', body;
  end if;
  if (select string_agg(g ->> 'repository' || '@' || left(g ->> 'sha', 1), ' ') from jsonb_array_elements(body -> 'graphs') g) <> 'kglink/front@b kgother/api@e' then
    raise exception 'FAIL: Carl''s link did not read the latest graph of each of its own repositories: %', body -> 'graphs';
  end if;
  if position('Link Web' in body::text) > 0 or position('Credit note' in body::text) > 0 or position('Never sell' in body::text) > 0 then
    raise exception 'FAIL: Carl''s link read something of KG Link''s product: %', body;
  end if;
  -- Another workspace's repository, refused and named, whichever link asks.
  perform pg_temp.refused($q$select pg_temp.read('omb_kglink_ada_0001', 'kgother/api')$q$, '42501', 'Ada''s link reading KG Other''s repository', 'kgother/api is not one of this workspace''s repositories');
  perform pg_temp.refused($q$select pg_temp.read('omb_kgother_carl_0005', 'kglink/back')$q$, '42501', 'Carl''s link reading KG Link''s repository', 'kglink/back');
end $$;

-- ── A link that does not work reads nothing ──
do $$
begin
  perform pg_temp.refused($q$select pg_temp.read('omb_kglink_ada_0002', 'kglink/front')$q$, '28000', 'a revoked link', 'Settings › Business');
  perform pg_temp.refused($q$select pg_temp.read('omb_nobody_0000', 'kglink/front')$q$, '28000', 'an unknown link');
  perform pg_temp.refused($q$select pg_temp.read('omk_kglink_ada_0003', 'kglink/front')$q$, '28000', 'a kit token');
  perform pg_temp.refused($q$select pg_temp.read('omb_kglink_leo_0004', 'kglink/front')$q$, '28000', 'the link of a maker who left');
  perform pg_temp.refused($q$select public.knowledge_graph_for_token(null, 'kglink/front')$q$, '28000', 'no token');
end $$;

-- ── One line for no single product ──
do $$
begin
  perform pg_temp.refused($q$select pg_temp.read('omb_kglink_ada_0001', 'widgets')$q$, '22023', 'a malformed repository', 'owner/name');
  perform pg_temp.refused($q$select pg_temp.read('omb_kglink_ada_0001', 'kglink/loose')$q$, '22023', 'a repository in no product', 'kglink/loose is not in exactly one product');
  perform pg_temp.refused($q$select pg_temp.read('omb_kgempty_kim_0006')$q$, '22023', 'a business with no product', 'no product yet');
end $$;
reset role;
insert into public.products (workspace_id, business_id, name, key)
select b.workspace_id, b.id, 'Other Admin', 'other-admin' from public.businesses b join public.workspaces w on w.id = b.workspace_id where w.slug = 'kg-other';
set local role anon;
do $$
begin
  perform pg_temp.refused($q$select pg_temp.read('omb_kgother_carl_0005')$q$, '22023', 'several products and no repository',
                          'sells several products, so name the repository you work in: kglink/front, kgother/api.');
  -- Named, its repository's only product still answers.
  if pg_temp.read('omb_kgother_carl_0005', 'kgother/api') -> 'product' ->> 'key' <> 'other-app' then
    raise exception 'FAIL: a repository of a business with several products did not read its only product';
  end if;
end $$;
reset role;

-- ── Nothing is written but `last used` ──
do $$
begin
  if (select t.last_used_at from public.agent_tokens t where t.token_hash = pg_temp.hash('omb_kglink_ada_0001')) is null then
    raise exception 'FAIL: the link''s last use did not move';
  end if;
  if (select count(*) from public.knowledge_graphs g where g.repository like 'kg%') <> 4 then
    raise exception 'FAIL: a read changed the stored graphs';
  end if;
end $$;

rollback;
