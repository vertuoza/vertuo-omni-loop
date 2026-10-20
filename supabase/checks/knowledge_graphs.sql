-- A repository's knowledge graph, pushed per commit (PRD 1798 s1). The supabase workflow runs it on every
-- pull request, after `supabase db start` has applied the migrations and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/knowledge_graphs.sql
-- knowledge_graph_push() keeps one row per repository and commit, for a member of a workspace that lists
-- the repository, with who pushed it and their GitHub login, and answers the products of the caller's own
-- workspaces that serve it. The same commit again leaves one row holding the second graph; the 21st
-- commit of one repository removes its oldest. A stranger, an account of no workspace and a signed-out
-- caller cannot push (42501) and read nothing; a malformed value is refused (22023) and nothing is
-- written; nobody writes the table directly. A repository two workspaces list is stored once and read by
-- the members of both.
-- One transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000017980a1', 'ada@graphs.test'),
  ('00000000-0000-4000-8000-0000017980c1', 'carl@graphs.test'),
  ('00000000-0000-4000-8000-0000017980e1', 'eve@graphs.test');
insert into auth.identities (user_id, provider, provider_id, identity_data) values
  ('00000000-0000-4000-8000-0000017980a1', 'github', '179801', '{"user_name": "Ada-GH"}'),
  ('00000000-0000-4000-8000-0000017980c1', 'github', '179802', '{"user_name": "carl-gh"}');
-- Ada belongs to Vertuoza, Carl to Acme, Eve to none.
insert into public.workspaces (slug, name, github_org) values ('acme-graphs', 'Acme', 'acme-graphs');
insert into public.workspace_members (workspace_id, user_id)
select w.id, m.user_id
  from (values ('vertuoza', '00000000-0000-4000-8000-0000017980a1'::uuid),
               ('acme-graphs', '00000000-0000-4000-8000-0000017980c1'::uuid)) as m (slug, user_id)
  join public.workspaces w on w.slug = m.slug;
insert into public.businesses (workspace_id, name)
select w.id, w.name from public.workspaces w
 where w.slug in ('vertuoza', 'acme-graphs') and not exists (select 1 from public.businesses b where b.workspace_id = w.id);
insert into public.products (workspace_id, business_id, name, key)
select b.workspace_id, b.id, x.name, x.key
  from (values ('vertuoza', 'Graph Mobile', 'graphs'), ('vertuoza', 'Graph Web', 'graph-web'), ('acme-graphs', 'Acme Graphs', 'acme-graphs'))
       as x (slug, name, key)
  join public.workspaces w on w.slug = x.slug
  join public.businesses b on b.workspace_id = w.id;
-- Vertuoza lists vertuoza/graph-api (in Graph Mobile, its own knowledge, and in Graph Web, with none) and
-- vertuoza/graph-web (in no product). Acme lists vertuoza/graph-api too, in Acme Graphs.
insert into public.repositories (workspace_id, full_name)
select w.id, r.name
  from (values ('vertuoza', 'vertuoza/graph-api'), ('vertuoza', 'vertuoza/graph-web'), ('acme-graphs', 'vertuoza/graph-api')) as r (slug, name)
  join public.workspaces w on w.slug = r.slug;
insert into public.product_repositories (product_id, workspace_id, repository, knowledge, added_by)
select p.id, p.workspace_id, 'vertuoza/graph-api', x.knowledge, 'person'
  from (values ('graphs', 'own'), ('graph-web', 'none'), ('acme-graphs', 'own')) as x (key, knowledge)
  join public.products p on p.key = x.key;

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
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

-- A commit's sha, from one letter.
create function pg_temp.sha(c text) returns text language sql immutable as $$ select repeat(c, 40) $$;
-- A repository's graph: a principle and the rule serving it, labelled `label`.
create function pg_temp.graph(label text default 'Quotes stay readable.') returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'version', 1, 'shape', 'repository',
    'nodes', jsonb_build_array(
      jsonb_build_object('id', 'P-PRODUCT-1', 'kind', 'principle', 'label', label, 'status', null,
                         'file', '.omni-loop/knowledge/product/principles.md', 'origin', 'repository'),
      jsonb_build_object('id', 'BR-PRODUCT-3', 'kind', 'rule', 'label', 'A quote shows its total.', 'status', 'law',
                         'file', '.omni-loop/knowledge/product/rules.md', 'origin', 'repository')),
    'edges', jsonb_build_array(jsonb_build_object('from', 'BR-PRODUCT-3', 'to', 'P-PRODUCT-1', 'kind', 'serves')));
$$;
-- Every stored graph, as one value to compare before and after a refusal.
create function pg_temp.graphs_of() returns text language sql security definer as $$
  select coalesce((select string_agg(row(g.*)::text, ';' order by g.repository, g.sha) from public.knowledge_graphs g), '');
$$;
-- The repositories and commits the signed-in caller reads.
create function pg_temp.seen() returns text language sql as $$
  select coalesce((select string_agg(g.repository || '@' || left(g.sha, 1), ' ' order by g.repository, g.sha) from public.knowledge_graphs g), '');
$$;

-- ── What the migration added, and who may write it ──
do $$
begin
  if has_table_privilege('authenticated', 'public.knowledge_graphs', 'insert')
     or has_table_privilege('authenticated', 'public.knowledge_graphs', 'update')
     or has_table_privilege('authenticated', 'public.knowledge_graphs', 'delete')
     or has_table_privilege('authenticated', 'public.knowledge_graphs', 'truncate')
     or has_table_privilege('service_role', 'public.knowledge_graphs', 'insert')
     or has_table_privilege('service_role', 'public.knowledge_graphs', 'update')
     or has_table_privilege('service_role', 'public.knowledge_graphs', 'delete') then
    raise exception 'FAIL: the graphs are written other than through knowledge_graph_push()';
  end if;
  if has_table_privilege('anon', 'public.knowledge_graphs', 'select') then
    raise exception 'FAIL: anon may read the graphs';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.knowledge_graphs'::regclass) then
    raise exception 'FAIL: the graphs are not under row-level security';
  end if;
  if has_function_privilege('anon', 'public.knowledge_graph_push(text, text, jsonb)', 'execute')
     or not has_function_privilege('authenticated', 'public.knowledge_graph_push(text, text, jsonb)', 'execute') then
    raise exception 'FAIL: knowledge_graph_push() is not the signed-in caller''s alone';
  end if;
  if not (select p.prosecdef from pg_proc p where p.oid = 'public.knowledge_graph_push(text, text, jsonb)'::regprocedure) then
    raise exception 'FAIL: knowledge_graph_push() is not security definer';
  end if;
end $$;

-- ── Ada pushes vertuoza/graph-api at commit a: one row, her login, Vertuoza's serving product ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000017980a1');
set local role authenticated;
do $$
declare
  answer jsonb := public.knowledge_graph_push('Vertuoza/Graph-API', upper(pg_temp.sha('a')), pg_temp.graph());
  kept   public.knowledge_graphs;
begin
  if answer ->> 'repository' <> 'vertuoza/graph-api' or answer ->> 'sha' <> pg_temp.sha('a')
     or (answer ->> 'nodes')::integer <> 2 or (answer ->> 'edges')::integer <> 1 or answer ->> 'pushedAt' is null then
    raise exception 'FAIL: a first push did not answer the repository, the commit and the counts: %', answer;
  end if;
  -- Graph Mobile serves its own knowledge; Graph Web's link holds none; Acme Graphs is another workspace's.
  if answer -> 'products' <> jsonb_build_array(jsonb_build_object('id', (select p.id from public.products p where p.key = 'graphs'), 'key', 'graphs')) then
    raise exception 'FAIL: the push did not answer Graph Mobile alone: %', answer -> 'products';
  end if;
  select * into kept from public.knowledge_graphs g where g.repository = 'vertuoza/graph-api';
  if not found or kept.sha <> pg_temp.sha('a') or kept.graph <> pg_temp.graph()
     or kept.pushed_by <> '00000000-0000-4000-8000-0000017980a1' or kept.pushed_by_login <> 'ada-gh' then
    raise exception 'FAIL: Ada did not read the graph she pushed, with her login: %', row_to_json(kept);
  end if;
  -- A repository in no product is stored, and serves no product.
  answer := public.knowledge_graph_push('vertuoza/graph-web', pg_temp.sha('a'), pg_temp.graph());
  if answer -> 'products' <> '[]'::jsonb then
    raise exception 'FAIL: a repository in no product answered products: %', answer;
  end if;
  if pg_temp.seen() <> 'vertuoza/graph-api@a vertuoza/graph-web@a' then
    raise exception 'FAIL: Ada does not read her workspace''s two graphs: %', pg_temp.seen();
  end if;
end $$;
reset role;

-- ── Malformed values are refused, and nothing is written ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000017980a1');
set local role authenticated;
do $$
declare
  before text := pg_temp.graphs_of();
begin
  perform pg_temp.refused(format('select public.knowledge_graph_push(''not a repo'', %L, %L)', pg_temp.sha('b'), pg_temp.graph()), '22023', 'a repository out of shape', 'Repository');
  perform pg_temp.refused(format('select public.knowledge_graph_push(''vertuoza/graph-api'', ''9086e70'', %L)', pg_temp.graph()), '22023', 'a short sha', 'Commit');
  perform pg_temp.refused(format('select public.knowledge_graph_push(''vertuoza/graph-api'', %L, %L)', pg_temp.sha('b'),
    pg_temp.graph() || '{"shape": "neighbourhood"}'), '22023', 'a neighbourhood for a graph', 'Graph');
  perform pg_temp.refused(format('select public.knowledge_graph_push(''vertuoza/graph-api'', %L, ''[]'')', pg_temp.sha('b')), '22023', 'a list for a graph', 'Graph');
  perform pg_temp.refused(format('select public.knowledge_graph_push(''vertuoza/graph-api'', %L, %L)', pg_temp.sha('b'),
    pg_temp.graph(repeat('x', 2100000))), '22023', 'a graph over 2 MiB', '2 MiB');
  -- Nobody writes the table directly, not even a member.
  perform pg_temp.refused(format('insert into public.knowledge_graphs (repository, sha, graph) values (''vertuoza/graph-api'', %L, %L)',
    pg_temp.sha('b'), pg_temp.graph()), '42501', 'a member inserting a graph');
  perform pg_temp.refused('update public.knowledge_graphs set graph = graph', '42501', 'a member updating a graph');
  perform pg_temp.refused('delete from public.knowledge_graphs', '42501', 'a member deleting a graph');
  if pg_temp.graphs_of() <> before then
    raise exception 'FAIL: a refused push changed the stored graphs';
  end if;
end $$;
reset role;

-- ── A stranger, an account of no workspace and a signed-out caller push nothing and read nothing ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000017980c1');
set local role authenticated;
do $$
declare
  before text := pg_temp.graphs_of();
begin
  -- Acme does not list vertuoza/graph-web: Carl is a stranger to it.
  perform pg_temp.refused(format('select public.knowledge_graph_push(''vertuoza/graph-web'', %L, %L)', pg_temp.sha('b'), pg_temp.graph()),
    '42501', 'a stranger pushing', 'vertuoza/graph-web');
  if pg_temp.graphs_of() <> before then
    raise exception 'FAIL: a stranger''s refused push stored a graph';
  end if;
  -- Acme lists vertuoza/graph-api: Carl reads its one graph, stored once for both workspaces.
  if pg_temp.seen() <> 'vertuoza/graph-api@a' then
    raise exception 'FAIL: Carl reads % (only vertuoza/graph-api, which Acme lists)', pg_temp.seen();
  end if;
end $$;
reset role;

select pg_temp.sign_in('00000000-0000-4000-8000-0000017980e1');
set local role authenticated;
do $$
begin
  perform pg_temp.refused(format('select public.knowledge_graph_push(''vertuoza/graph-api'', %L, %L)', pg_temp.sha('b'), pg_temp.graph()),
    '42501', 'an account of no workspace pushing', 'vertuoza/graph-api');
  if pg_temp.seen() <> '' then
    raise exception 'FAIL: an account of no workspace reads %', pg_temp.seen();
  end if;
end $$;
reset role;

-- Signed in as nobody: the function refuses before anything.
select set_config('request.jwt.claims', json_build_object('role', 'authenticated')::text, true);
set local role authenticated;
select pg_temp.refused(format('select public.knowledge_graph_push(''vertuoza/graph-api'', %L, %L)', pg_temp.sha('b'), pg_temp.graph()),
  '42501', 'a token naming nobody pushing', 'Sign in first');
do $$
begin
  if pg_temp.seen() <> '' then
    raise exception 'FAIL: a token naming nobody reads %', pg_temp.seen();
  end if;
end $$;
reset role;

select pg_temp.sign_out();
set local role anon;
select pg_temp.refused(format('select public.knowledge_graph_push(''vertuoza/graph-api'', %L, %L)', pg_temp.sha('b'), pg_temp.graph()),
  '42501', 'a signed-out caller pushing');
select pg_temp.refused('select count(*) from public.knowledge_graphs', '42501', 'a signed-out caller reading');
reset role;

-- ── The same commit again: one row, holding the second graph and its pusher ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000017980c1');
set local role authenticated;
do $$
declare
  answer jsonb := public.knowledge_graph_push('vertuoza/graph-api', pg_temp.sha('a'), pg_temp.graph('Quotes stay short.'));
begin
  -- Carl, of Acme, is answered Acme's serving product, never Vertuoza's.
  if answer -> 'products' -> 0 ->> 'key' <> 'acme-graphs' or jsonb_array_length(answer -> 'products') <> 1 then
    raise exception 'FAIL: Carl''s push did not answer Acme Graphs alone: %', answer -> 'products';
  end if;
end $$;
reset role;
do $$
declare
  rows public.knowledge_graphs[];
begin
  select array_agg(g) into rows from public.knowledge_graphs g where g.repository = 'vertuoza/graph-api';
  if cardinality(rows) <> 1 or rows[1].sha <> pg_temp.sha('a') or rows[1].graph <> pg_temp.graph('Quotes stay short.')
     or rows[1].pushed_by <> '00000000-0000-4000-8000-0000017980c1' or rows[1].pushed_by_login <> 'carl-gh' then
    raise exception 'FAIL: a repeat of one commit did not leave one row holding the second graph: %', to_jsonb(rows);
  end if;
end $$;

-- ── The 21st commit of one repository removes its oldest ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000017980a1');
set local role authenticated;
do $$
declare
  c text;
begin
  -- Nineteen more commits: twenty kept, a among them.
  foreach c in array string_to_array('b c d e f 0 1 2 3 4 5 6 7 8 9', ' ') || array['ab', 'cd', 'ef', '01'] loop
    perform public.knowledge_graph_push('vertuoza/graph-api', left(repeat(c, 40), 40), pg_temp.graph());
  end loop;
  if (select count(*) from public.knowledge_graphs g where g.repository = 'vertuoza/graph-api') <> 20
     or not exists (select 1 from public.knowledge_graphs g where g.repository = 'vertuoza/graph-api' and g.sha = pg_temp.sha('a')) then
    raise exception 'FAIL: twenty commits were not all kept';
  end if;
  -- The 21st: a, the oldest pushed, is gone; the other repository keeps its own.
  perform public.knowledge_graph_push('vertuoza/graph-api', left(repeat('23', 20), 40), pg_temp.graph());
  if (select count(*) from public.knowledge_graphs g where g.repository = 'vertuoza/graph-api') <> 20
     or exists (select 1 from public.knowledge_graphs g where g.repository = 'vertuoza/graph-api' and g.sha = pg_temp.sha('a')) then
    raise exception 'FAIL: the 21st commit did not remove the oldest: %',
      (select string_agg(left(g.sha, 2), ' ' order by g.pushed_at) from public.knowledge_graphs g where g.repository = 'vertuoza/graph-api');
  end if;
  if not exists (select 1 from public.knowledge_graphs g where g.repository = 'vertuoza/graph-web' and g.sha = pg_temp.sha('a')) then
    raise exception 'FAIL: one repository''s pushes removed another''s graph';
  end if;
end $$;
reset role;

rollback;

select 'knowledge graphs checks passed' as result;
