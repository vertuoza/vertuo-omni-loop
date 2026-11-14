-- A product's logged searches get a category and a group: who reads and writes them, which group is nearest,
-- and how long a group is kept (PRD omni-loop-7 s1, 20270120093000_mcp_search_groups.sql). The supabase
-- workflow runs it on every pull request, after `supabase db start` has applied the migrations and the demo
-- seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/mcp_search_groups.sql
-- A member of a product's workspace reads its groups, and the category and group of its searches (L-GDPR-1,
-- BR-PRODUCT-63); a member of another workspace reads none of them, and anon reads nothing. Only the service
-- role writes: it adds groups, and sets a search's category and group, nothing else of either. A search
-- never joins another product's group, and a category is at most 80 characters.
-- mcp_search_group_nearest() answers the one group of the product and model nearest to a vector, with its
-- cosine, and never another product's. jev_decision_names() answers `search-category` beside the seven it
-- answered. The nightly mcp_search_log_forget() also deletes a group none of whose searches is left, and keeps
-- one with a search left, or whose first search is not forgotten yet (L-GDPR-4).
-- One transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

-- ── The cast ──
-- Lia owns Lantern and Max is a member of it; Hal owns Harbor. Lantern sells Lamp and Wick, Harbor sells Dock.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000007a1', 'lia@lantern.test'),
  ('00000000-0000-4000-8000-0000000007b1', 'max@lantern.test'),
  ('00000000-0000-4000-8000-0000000007c1', 'hal@harbor.test');
insert into public.workspaces (id, slug, name, github_org) values
  ('00000000-0000-4000-8000-000000000710', 'lantern-search-groups', 'Lantern', 'lantern-search-groups'),
  ('00000000-0000-4000-8000-000000000720', 'harbor-search-groups', 'Harbor', 'harbor-search-groups');
insert into public.workspace_members (workspace_id, user_id, role) values
  ('00000000-0000-4000-8000-000000000710', '00000000-0000-4000-8000-0000000007a1', 'owner'),
  ('00000000-0000-4000-8000-000000000710', '00000000-0000-4000-8000-0000000007b1', 'member'),
  ('00000000-0000-4000-8000-000000000720', '00000000-0000-4000-8000-0000000007c1', 'owner')
on conflict (workspace_id, user_id) do nothing;
insert into public.businesses (workspace_id, name) values
  ('00000000-0000-4000-8000-000000000710', 'Lantern'),
  ('00000000-0000-4000-8000-000000000720', 'Harbor');
insert into public.products (id, workspace_id, business_id, name, key)
select x.id::uuid, b.workspace_id, b.id, x.name, x.key
  from (values ('00000000-0000-4000-8000-000000000710', '00000000-0000-4000-8000-0000000007f1', 'Lamp', 'lamp'),
               ('00000000-0000-4000-8000-000000000710', '00000000-0000-4000-8000-0000000007f3', 'Wick', 'wick'),
               ('00000000-0000-4000-8000-000000000720', '00000000-0000-4000-8000-0000000007f2', 'Dock', 'dock'))
       as x (ws, id, name, key)
  join public.businesses b on b.workspace_id = x.ws::uuid;

-- A 384-long vector whose first two numbers are a and b, the rest 0.
create function pg_temp.vec(a float8, b float8) returns extensions.vector language sql immutable as $$
  select ('[' || string_agg((case g when 1 then a when 2 then b else 0 end)::text, ',' order by g) || ']')::extensions.vector
    from generate_series(1, 384) g;
$$;
create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
-- Runs a statement that must be refused with `code`.
create function pg_temp.refused(stmt text, code text, why text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % ran: %', why, stmt;
exception when others then
  if sqlstate <> code then raise exception 'FAIL: % answered % (%), not %', why, sqlstate, sqlerrm, code; end if;
end;
$$;
-- How many groups, and how many categorized or grouped searches, the role now in force reads.
create function pg_temp.groups_seen() returns bigint language sql as $$
  select count(*) from public.mcp_search_groups;
$$;
create function pg_temp.sorted_seen() returns bigint language sql as $$
  select count(*) from public.mcp_search_log where category is not null or group_id is not null;
$$;
grant execute on function pg_temp.vec(float8, float8) to anon, authenticated, service_role;
grant execute on function pg_temp.refused(text, text, text) to anon, authenticated, service_role;
grant execute on function pg_temp.groups_seen() to anon, authenticated, service_role;
grant execute on function pg_temp.sorted_seen() to anon, authenticated, service_role;

-- ── Who may do what ──
do $$
begin
  if has_table_privilege('anon', 'public.mcp_search_groups', 'select, insert, update, delete') then
    raise exception 'FAIL: anon reads or writes the search groups';
  end if;
  if not has_table_privilege('authenticated', 'public.mcp_search_groups', 'select')
     or has_table_privilege('authenticated', 'public.mcp_search_groups', 'insert, update, delete')
     or has_any_column_privilege('authenticated', 'public.mcp_search_groups', 'insert, update') then
    raise exception 'FAIL: the signed in do not only read the search groups';
  end if;
  if not has_table_privilege('service_role', 'public.mcp_search_groups', 'select')
     or not has_table_privilege('service_role', 'public.mcp_search_groups', 'insert')
     or has_table_privilege('service_role', 'public.mcp_search_groups', 'update, delete')
     or has_any_column_privilege('service_role', 'public.mcp_search_groups', 'update') then
    raise exception 'FAIL: the service role does not read and add groups alone';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.mcp_search_groups'::regclass) then
    raise exception 'FAIL: the search groups have no row-level security';
  end if;
  -- The log: members read the two new columns; the service role sets them, and still nothing else.
  if not has_column_privilege('authenticated', 'public.mcp_search_log', 'category', 'select')
     or not has_column_privilege('authenticated', 'public.mcp_search_log', 'group_id', 'select')
     or has_any_column_privilege('authenticated', 'public.mcp_search_log', 'insert, update') then
    raise exception 'FAIL: the signed in do not only read a search''s category and group';
  end if;
  if not has_column_privilege('service_role', 'public.mcp_search_log', 'category', 'update')
     or not has_column_privilege('service_role', 'public.mcp_search_log', 'group_id', 'update')
     or has_table_privilege('service_role', 'public.mcp_search_log', 'update, delete')
     or has_column_privilege('service_role', 'public.mcp_search_log', 'query', 'update')
     or has_column_privilege('service_role', 'public.mcp_search_log', 'product_id', 'update')
     or has_column_privilege('service_role', 'public.mcp_search_log', 'workspace_id', 'update') then
    raise exception 'FAIL: the service role does not set a search''s category and group alone';
  end if;
  if has_function_privilege('anon', 'public.mcp_search_group_nearest(uuid, text, extensions.vector)', 'execute')
     or has_function_privilege('authenticated', 'public.mcp_search_group_nearest(uuid, text, extensions.vector)', 'execute')
     or not has_function_privilege('service_role', 'public.mcp_search_group_nearest(uuid, text, extensions.vector)', 'execute') then
    raise exception 'FAIL: mcp_search_group_nearest() is not the service role''s alone';
  end if;
  if has_function_privilege('anon', 'public.mcp_search_log_forget()', 'execute')
     or has_function_privilege('authenticated', 'public.mcp_search_log_forget()', 'execute')
     or not has_function_privilege('service_role', 'public.mcp_search_log_forget()', 'execute') then
    raise exception 'FAIL: mcp_search_log_forget() is not the service role''s alone any more';
  end if;
end $$;

-- ── search-category is a Jev decision, beside the seven ──
do $$
begin
  -- The seven and search-category, in that order; a later decision (search-relevant, PRD omni-loop-8) follows.
  if (public.jev_decision_names())[1:8] is distinct from array['question-category', 'outbox-risk', 'bug-risk',
       'unknown-worth-asking', 'constituent-break', 'hitl-category', 'law-worth', 'search-category'] then
    raise exception 'FAIL: jev_decision_names() answers %, not the seven and search-category', public.jev_decision_names();
  end if;
  if exists (select 1 from public.jev_decisions d where d.decision = 'search-category') then
    raise exception 'FAIL: a workspace starts with search-category set';
  end if;
end $$;

-- ── The service role adds searches and groups, and sorts the searches ──
set local role service_role;
insert into public.mcp_search_log (id, product_id, workspace_id, tool, query, mode, total) values
  ('00000000-0000-4000-8000-000000000751', '00000000-0000-4000-8000-0000000007f1', '00000000-0000-4000-8000-000000000710',
   'search_knowledge', 'can a quote be sent without a payment term', 'meaning', 3),
  ('00000000-0000-4000-8000-000000000752', '00000000-0000-4000-8000-0000000007f1', '00000000-0000-4000-8000-000000000710',
   'search_knowledge', 'can a quote go out with no payment term', 'meaning', 2),
  ('00000000-0000-4000-8000-000000000753', '00000000-0000-4000-8000-0000000007f1', '00000000-0000-4000-8000-000000000710',
   'search_knowledge', 'who signs an invoice', 'words', 0),
  ('00000000-0000-4000-8000-000000000754', '00000000-0000-4000-8000-0000000007f3', '00000000-0000-4000-8000-000000000710',
   'search_knowledge', 'how long does a wick burn', 'meaning', 1),
  ('00000000-0000-4000-8000-000000000755', '00000000-0000-4000-8000-0000000007f2', '00000000-0000-4000-8000-000000000720',
   'search_knowledge', 'dock ledger', 'words', 0);
-- Lamp's quote group (first: 751), its invoice group (first: 753), and an invoice group of another model;
-- Wick's group, nearer to the quote question than Lamp's own; Dock's group.
insert into public.mcp_search_groups (id, product_id, workspace_id, first_search_id, question, model, embedding) values
  ('00000000-0000-4000-8000-000000000761', '00000000-0000-4000-8000-0000000007f1', '00000000-0000-4000-8000-000000000710',
   '00000000-0000-4000-8000-000000000751', 'can a quote be sent without a payment term', 'gte-small', pg_temp.vec(1, 0)),
  ('00000000-0000-4000-8000-000000000762', '00000000-0000-4000-8000-0000000007f1', '00000000-0000-4000-8000-000000000710',
   '00000000-0000-4000-8000-000000000753', 'who signs an invoice', 'gte-small', pg_temp.vec(0, 1)),
  ('00000000-0000-4000-8000-000000000763', '00000000-0000-4000-8000-0000000007f1', '00000000-0000-4000-8000-000000000710',
   null, 'who signs an invoice', 'other-model', pg_temp.vec(1, 0.05)),
  ('00000000-0000-4000-8000-000000000764', '00000000-0000-4000-8000-0000000007f3', '00000000-0000-4000-8000-000000000710',
   '00000000-0000-4000-8000-000000000754', 'how long does a wick burn', 'gte-small', pg_temp.vec(1, 0.05)),
  ('00000000-0000-4000-8000-000000000765', '00000000-0000-4000-8000-0000000007f2', '00000000-0000-4000-8000-000000000720',
   '00000000-0000-4000-8000-000000000755', 'dock ledger', 'gte-small', pg_temp.vec(1, 0));
update public.mcp_search_log set group_id = '00000000-0000-4000-8000-000000000761', category = 'quotes'
 where id in ('00000000-0000-4000-8000-000000000751', '00000000-0000-4000-8000-000000000752');
update public.mcp_search_log set group_id = '00000000-0000-4000-8000-000000000762', category = 'other'
 where id = '00000000-0000-4000-8000-000000000753';
update public.mcp_search_log set group_id = '00000000-0000-4000-8000-000000000764'
 where id = '00000000-0000-4000-8000-000000000754';
update public.mcp_search_log set group_id = '00000000-0000-4000-8000-000000000765', category = 'other'
 where id = '00000000-0000-4000-8000-000000000755';

-- A group's workspace is its product's; a search never joins another product's group; a category is 1 to 80
-- characters; a group's vector is 384 numbers.
select pg_temp.refused($q$insert into public.mcp_search_groups (product_id, workspace_id, question, model, embedding)
  values ('00000000-0000-4000-8000-0000000007f2', '00000000-0000-4000-8000-000000000710', 'x', 'gte-small', pg_temp.vec(1, 0))$q$,
  '23503', 'a group of Dock filed under Lantern');
select pg_temp.refused($q$update public.mcp_search_log set group_id = '00000000-0000-4000-8000-000000000765'
  where id = '00000000-0000-4000-8000-000000000753'$q$,
  '23503', 'a Lamp search joining a Dock group');
select pg_temp.refused($q$update public.mcp_search_log set group_id = '00000000-0000-4000-8000-000000000764'
  where id = '00000000-0000-4000-8000-000000000753'$q$,
  '23503', 'a Lamp search joining a Wick group');
select pg_temp.refused(format($q$update public.mcp_search_log set category = %L where id = '00000000-0000-4000-8000-000000000753'$q$,
  repeat('q', 81)), '23514', 'a category of 81 characters');
select pg_temp.refused($q$update public.mcp_search_log set category = '' where id = '00000000-0000-4000-8000-000000000753'$q$,
  '23514', 'an empty category');
select pg_temp.refused($q$insert into public.mcp_search_groups (product_id, workspace_id, question, model, embedding)
  values ('00000000-0000-4000-8000-0000000007f1', '00000000-0000-4000-8000-000000000710', 'x', 'gte-small', '[1,0,0]')$q$,
  '22000', 'a vector not 384 long');
select pg_temp.refused($q$insert into public.mcp_search_groups (product_id, workspace_id, question, model, embedding)
  values ('00000000-0000-4000-8000-0000000007f1', '00000000-0000-4000-8000-000000000710', 'x', 'Not A Model', pg_temp.vec(1, 0))$q$,
  '23514', 'a model that is not a lower-case name');
-- It changes nothing else of a group, and deletes none.
select pg_temp.refused($q$update public.mcp_search_groups set question = 'rewritten'$q$, '42501', 'the service role rewriting a group');
select pg_temp.refused($q$delete from public.mcp_search_groups$q$, '42501', 'the service role deleting groups');
do $$
begin
  if pg_temp.groups_seen() <> 5 or pg_temp.sorted_seen() <> 5 then
    raise exception 'FAIL: the service role reads % groups and % sorted searches, not 5 and 5', pg_temp.groups_seen(), pg_temp.sorted_seen();
  end if;
end $$;
reset role;

-- ── The nearest group: the product's and the model's, never another's ──
set local role service_role;
do $$
declare
  g uuid;
  c double precision;
  n integer;
begin
  -- Wick's group is the nearest of all to (1, 0.04); Lamp's quote group is Lamp's nearest.
  select x.group_id, x.cosine into g, c
    from public.mcp_search_group_nearest('00000000-0000-4000-8000-0000000007f1', 'gte-small', pg_temp.vec(1, 0.04)) x;
  if g is distinct from '00000000-0000-4000-8000-000000000761' then
    raise exception 'FAIL: Lamp''s nearest group to (1, 0.04) is %, not its quote group', g;
  end if;
  if c is null or abs(c - 1 / sqrt(1 + 0.04 * 0.04)) > 1e-6 then
    raise exception 'FAIL: the cosine answered is %, not %', c, 1 / sqrt(1 + 0.04 * 0.04);
  end if;
  select count(*) into n
    from public.mcp_search_group_nearest('00000000-0000-4000-8000-0000000007f1', 'gte-small', pg_temp.vec(1, 0.04));
  if n <> 1 then raise exception 'FAIL: the nearest answers % rows, not one', n; end if;
  -- (0.1, 1) is nearest to the invoice group.
  select x.group_id into g
    from public.mcp_search_group_nearest('00000000-0000-4000-8000-0000000007f1', 'gte-small', pg_temp.vec(0.1, 1)) x;
  if g is distinct from '00000000-0000-4000-8000-000000000762' then
    raise exception 'FAIL: Lamp''s nearest group to (0.1, 1) is %, not its invoice group', g;
  end if;
  -- Another model reads only that model's groups.
  select x.group_id into g
    from public.mcp_search_group_nearest('00000000-0000-4000-8000-0000000007f1', 'other-model', pg_temp.vec(0, 1)) x;
  if g is distinct from '00000000-0000-4000-8000-000000000763' then
    raise exception 'FAIL: the nearest of other-model is %, not its one group', g;
  end if;
  -- Wick reads its own group alone.
  select x.group_id into g
    from public.mcp_search_group_nearest('00000000-0000-4000-8000-0000000007f3', 'gte-small', pg_temp.vec(0, 1)) x;
  if g is distinct from '00000000-0000-4000-8000-000000000764' then
    raise exception 'FAIL: Wick''s nearest group is %, not its own', g;
  end if;
  -- A product with no group answers nothing.
  select count(*) into n from public.mcp_search_group_nearest(gen_random_uuid(), 'gte-small', pg_temp.vec(1, 0));
  if n <> 0 then raise exception 'FAIL: a product with no group answers % rows', n; end if;
end $$;
select pg_temp.refused($q$select * from public.mcp_search_group_nearest('00000000-0000-4000-8000-0000000007f1', 'gte-small', '[1,0,0]')$q$,
  '22023', 'a query not 384 long');
reset role;

-- ── Members read their workspace's groups and sorting, and nobody else's ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000007b1');
do $$
begin
  if pg_temp.groups_seen() <> 4
     or exists (select 1 from public.mcp_search_groups where workspace_id <> '00000000-0000-4000-8000-000000000710') then
    raise exception 'FAIL: Max, a member of Lantern, does not read Lamp''s and Wick''s four groups alone';
  end if;
  if pg_temp.sorted_seen() <> 4
     or (select category from public.mcp_search_log where id = '00000000-0000-4000-8000-000000000752') is distinct from 'quotes'
     or (select group_id from public.mcp_search_log where id = '00000000-0000-4000-8000-000000000752')
        is distinct from '00000000-0000-4000-8000-000000000761' then
    raise exception 'FAIL: Max does not read the category and group of Lantern''s searches';
  end if;
end $$;
select pg_temp.refused($q$insert into public.mcp_search_groups (product_id, workspace_id, question, model, embedding)
  values ('00000000-0000-4000-8000-0000000007f1', '00000000-0000-4000-8000-000000000710', 'x', 'gte-small', pg_temp.vec(1, 0))$q$,
  '42501', 'a member adding a group');
select pg_temp.refused($q$update public.mcp_search_log set category = 'quotes'$q$, '42501', 'a member setting a category');
select pg_temp.refused($q$update public.mcp_search_log set group_id = null$q$, '42501', 'a member ungrouping a search');
select pg_temp.refused($q$delete from public.mcp_search_groups$q$, '42501', 'a member deleting groups');
select pg_temp.refused($q$select * from public.mcp_search_group_nearest('00000000-0000-4000-8000-0000000007f1', 'gte-small', pg_temp.vec(1, 0))$q$,
  '42501', 'a member asking the nearest group');
select pg_temp.sign_in('00000000-0000-4000-8000-0000000007c1');
do $$
begin
  if pg_temp.groups_seen() <> 1 or (select question from public.mcp_search_groups) is distinct from 'dock ledger' then
    raise exception 'FAIL: Hal, of Harbor, does not read Dock''s one group alone';
  end if;
  if pg_temp.sorted_seen() <> 1 then
    raise exception 'FAIL: Hal reads % sorted searches, not Dock''s one', pg_temp.sorted_seen();
  end if;
end $$;
reset role;

set local role anon;
select pg_temp.refused($q$select * from public.mcp_search_groups$q$, '42501', 'anon reading the groups');
select pg_temp.refused($q$select * from public.mcp_search_group_nearest('00000000-0000-4000-8000-0000000007f1', 'gte-small', pg_temp.vec(1, 0))$q$,
  '42501', 'anon asking the nearest group');
reset role;

-- ── Forget also deletes a group none of whose searches is left ──
-- The quote group: its first search 91 days old (goes), the second 89 (stays): kept, though its first search
-- is gone. The invoice group: its one search 120 days old (goes): deleted. Wick's group: its one search young:
-- kept. Dock's group: its search 95 days old (goes): deleted. A group just started, whose first search is young
-- and not joined yet (the job sets the search's group after it adds the group): kept. other-model's group,
-- whose first search was never known and which no search joined: deleted.
update public.mcp_search_log set asked_at = now() - interval '91 days' where id = '00000000-0000-4000-8000-000000000751';
update public.mcp_search_log set asked_at = now() - interval '89 days' where id = '00000000-0000-4000-8000-000000000752';
update public.mcp_search_log set asked_at = now() - interval '120 days' where id = '00000000-0000-4000-8000-000000000753';
update public.mcp_search_log set asked_at = now() - interval '95 days' where id = '00000000-0000-4000-8000-000000000755';
set local role service_role;
insert into public.mcp_search_log (id, product_id, workspace_id, tool, query, mode, total) values
  ('00000000-0000-4000-8000-000000000756', '00000000-0000-4000-8000-0000000007f1', '00000000-0000-4000-8000-000000000710',
   'search_knowledge', 'how is a lamp shipped', 'meaning', 4);
insert into public.mcp_search_groups (id, product_id, workspace_id, first_search_id, question, model, embedding) values
  ('00000000-0000-4000-8000-000000000766', '00000000-0000-4000-8000-0000000007f1', '00000000-0000-4000-8000-000000000710',
   '00000000-0000-4000-8000-000000000756', 'how is a lamp shipped', 'gte-small', pg_temp.vec(0.5, 0.5));
do $$
declare
  n integer := public.mcp_search_log_forget();
  kept uuid[];
begin
  if n <> 3 then raise exception 'FAIL: forget deleted % searches, not the three older than 90 days', n; end if;
  select array_agg(id order by id) into kept from public.mcp_search_groups
   where id::text like '00000000-0000-4000-8000-00000000076_';
  if kept is distinct from array['00000000-0000-4000-8000-000000000761', '00000000-0000-4000-8000-000000000764',
                                 '00000000-0000-4000-8000-000000000766']::uuid[] then
    raise exception 'FAIL: forget kept the groups %, not the quote group, Wick''s and the one just started', kept;
  end if;
  if (select first_search_id from public.mcp_search_groups where id = '00000000-0000-4000-8000-000000000761') is not null
     or (select question from public.mcp_search_groups where id = '00000000-0000-4000-8000-000000000761')
        is distinct from 'can a quote be sent without a payment term' then
    raise exception 'FAIL: the quote group does not keep its first question once its first search is forgotten';
  end if;
end $$;
-- The search joins the group just started, which forget kept.
update public.mcp_search_log set group_id = '00000000-0000-4000-8000-000000000766'
 where id = '00000000-0000-4000-8000-000000000756';
reset role;

-- ── A product's groups go with it ──
delete from public.products where id = '00000000-0000-4000-8000-0000000007f1';
do $$
begin
  if exists (select 1 from public.mcp_search_groups where product_id = '00000000-0000-4000-8000-0000000007f1') then
    raise exception 'FAIL: a deleted product''s groups survived it';
  end if;
end $$;

rollback;
