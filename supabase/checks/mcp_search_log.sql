-- A product's MCP server logs every search it answers: who reads and writes the log (PRD omni-loop-6 s1,
-- 20270119090000_mcp_search_log.sql). The supabase workflow runs it on every pull request, after
-- `supabase db start` has applied the migrations and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/mcp_search_log.sql
-- A member of a product's workspace reads its rows (L-GDPR-1, BR-PRODUCT-63); a member of another workspace
-- reads none of them, and anon reads nothing. Only the service role writes: it adds rows and fills the
-- opened id and rank, nothing else of a row; a row is never filed under a workspace that is not its
-- product's. product_mcp_for_key() answers the served key's id, never the key. mcp_search_log_forget(), run
-- every night, deletes the rows asked more than 90 days ago and keeps the younger ones (L-GDPR-4).
-- One transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

-- ── The cast ──
-- Lia owns Lantern and Max is a member of it; Hal owns Harbor. Lantern sells Lamp (key lamp), Harbor sells
-- Dock (key dock). Both servers are on; Lia holds an API key of Lantern.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000006a1', 'lia@lantern.test'),
  ('00000000-0000-4000-8000-0000000006b1', 'max@lantern.test'),
  ('00000000-0000-4000-8000-0000000006c1', 'hal@harbor.test');
insert into public.workspaces (id, slug, name, github_org) values
  ('00000000-0000-4000-8000-000000000610', 'lantern-search-log', 'Lantern', 'lantern-search-log'),
  ('00000000-0000-4000-8000-000000000620', 'harbor-search-log', 'Harbor', 'harbor-search-log');
insert into public.workspace_members (workspace_id, user_id, role) values
  ('00000000-0000-4000-8000-000000000610', '00000000-0000-4000-8000-0000000006a1', 'owner'),
  ('00000000-0000-4000-8000-000000000610', '00000000-0000-4000-8000-0000000006b1', 'member'),
  ('00000000-0000-4000-8000-000000000620', '00000000-0000-4000-8000-0000000006c1', 'owner')
on conflict (workspace_id, user_id) do nothing;
insert into public.businesses (workspace_id, name) values
  ('00000000-0000-4000-8000-000000000610', 'Lantern'),
  ('00000000-0000-4000-8000-000000000620', 'Harbor');
insert into public.products (id, workspace_id, business_id, name, key, mcp_enabled)
select x.id::uuid, b.workspace_id, b.id, x.name, x.key, true
  from (values ('00000000-0000-4000-8000-000000000610', '00000000-0000-4000-8000-0000000006f1', 'Lamp', 'lamp'),
               ('00000000-0000-4000-8000-000000000620', '00000000-0000-4000-8000-0000000006f2', 'Dock', 'dock'))
       as x (ws, id, name, key)
  join public.businesses b on b.workspace_id = x.ws::uuid;

create function pg_temp.hash(secret text) returns text language sql immutable as $$
  select encode(sha256(convert_to(secret, 'UTF8')), 'hex');
$$;
insert into public.agent_tokens (id, workspace_id, made_by, name, token_hash, last_four, scope, repos) values
  ('00000000-0000-4000-8000-0000000006e1', '00000000-0000-4000-8000-000000000610', '00000000-0000-4000-8000-0000000006a1',
   'Lia''s agent', pg_temp.hash('oma_lantern_search_log_0001'), '0001', 'api', '{}');

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
-- How many rows of the log the role now in force reads.
create function pg_temp.seen() returns bigint language sql as $$
  select count(*) from public.mcp_search_log;
$$;
grant execute on function pg_temp.hash(text) to service_role;
grant execute on function pg_temp.refused(text, text, text) to anon, authenticated, service_role;
grant execute on function pg_temp.seen() to anon, authenticated, service_role;

-- ── Who may do what ──
do $$
begin
  if has_table_privilege('anon', 'public.mcp_search_log', 'select, insert, update, delete') then
    raise exception 'FAIL: anon reads or writes the MCP search log';
  end if;
  if not has_table_privilege('authenticated', 'public.mcp_search_log', 'select')
     or has_table_privilege('authenticated', 'public.mcp_search_log', 'insert, update, delete')
     or has_any_column_privilege('authenticated', 'public.mcp_search_log', 'insert, update') then
    raise exception 'FAIL: the signed in do not only read the MCP search log';
  end if;
  if not has_table_privilege('service_role', 'public.mcp_search_log', 'select')
     or not has_table_privilege('service_role', 'public.mcp_search_log', 'insert')
     or has_table_privilege('service_role', 'public.mcp_search_log', 'update, delete')
     or not has_column_privilege('service_role', 'public.mcp_search_log', 'opened_id', 'update')
     or not has_column_privilege('service_role', 'public.mcp_search_log', 'opened_rank', 'update')
     or has_column_privilege('service_role', 'public.mcp_search_log', 'query', 'update')
     or has_column_privilege('service_role', 'public.mcp_search_log', 'hit_ids', 'update')
     or has_column_privilege('service_role', 'public.mcp_search_log', 'workspace_id', 'update') then
    raise exception 'FAIL: the service role does not read, add rows and fill the opened rank alone';
  end if;
  if has_function_privilege('anon', 'public.mcp_search_log_forget()', 'execute')
     or has_function_privilege('authenticated', 'public.mcp_search_log_forget()', 'execute')
     or not has_function_privilege('service_role', 'public.mcp_search_log_forget()', 'execute') then
    raise exception 'FAIL: mcp_search_log_forget() is not the service role''s alone';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.mcp_search_log'::regclass) then
    raise exception 'FAIL: the MCP search log has no row-level security';
  end if;
  if not exists (select 1 from cron.job where jobname = 'mcp-search-log-forget'
                  and command = 'select public.mcp_search_log_forget()' and schedule = '51 3 * * *') then
    raise exception 'FAIL: nothing runs mcp_search_log_forget() every night';
  end if;
end $$;

-- ── The key's id, never the key ──
set local role service_role;
do $$
declare
  got jsonb := public.product_mcp_for_key(pg_temp.hash('oma_lantern_search_log_0001'), 'lamp');
begin
  if got->>'key_id' is distinct from '00000000-0000-4000-8000-0000000006e1' then
    raise exception 'FAIL: product_mcp_for_key() answers key_id %, not the served key''s id', got->>'key_id';
  end if;
  if got::text like '%oma_lantern_search_log_0001%' or got::text like '%' || pg_temp.hash('oma_lantern_search_log_0001') || '%' then
    raise exception 'FAIL: product_mcp_for_key() answers the key or its hash';
  end if;
end $$;
reset role;

-- ── The service role adds rows ──
set local role service_role;
insert into public.mcp_search_log (product_id, workspace_id, api_key_id, tool, query, filters, mode, total, hit_ids) values
  ('00000000-0000-4000-8000-0000000006f1', '00000000-0000-4000-8000-000000000610', '00000000-0000-4000-8000-0000000006e1',
   'search_knowledge', 'can a quote go out empty', '{"kind": "business-law"}', 'meaning', 3, '{BL-QUOTES-1,BL-QUOTES-2,ADR-0067}'),
  ('00000000-0000-4000-8000-0000000006f1', '00000000-0000-4000-8000-000000000610', '00000000-0000-4000-8000-0000000006e1',
   'get_knowledge', 'BL-QUOTES-2', '{}', null, 1, '{BL-QUOTES-2}'),
  ('00000000-0000-4000-8000-0000000006f2', '00000000-0000-4000-8000-000000000620', null,
   'search_knowledge', 'dock ledger', '{}', 'words', 0, '{}');
-- A row is never filed under a workspace that is not its product's.
select pg_temp.refused($q$insert into public.mcp_search_log (product_id, workspace_id, tool, query, total)
  values ('00000000-0000-4000-8000-0000000006f2', '00000000-0000-4000-8000-000000000610', 'search_knowledge', 'x', 0)$q$,
  '23503', 'a row of Dock filed under Lantern');
select pg_temp.refused($q$insert into public.mcp_search_log (product_id, workspace_id, tool, query, total)
  values ('00000000-0000-4000-8000-0000000006f1', '00000000-0000-4000-8000-000000000610', 'list_everything', 'x', 0)$q$,
  '23514', 'a tool the server does not have');
-- It fills the opened id and rank, together, and nothing else of a row; it deletes nothing.
update public.mcp_search_log set opened_id = 'BL-QUOTES-2', opened_rank = 2
 where tool = 'search_knowledge' and query = 'can a quote go out empty';
select pg_temp.refused($q$update public.mcp_search_log set opened_rank = 3 where query = 'dock ledger'$q$,
  '23514', 'an opened rank with no opened id');
select pg_temp.refused($q$update public.mcp_search_log set query = 'rewritten'$q$, '42501', 'the service role rewriting a query');
select pg_temp.refused($q$delete from public.mcp_search_log$q$, '42501', 'the service role deleting rows');
do $$
begin
  if pg_temp.seen() <> 3 then raise exception 'FAIL: the service role reads % rows, not 3', pg_temp.seen(); end if;
  if (select opened_rank from public.mcp_search_log where query = 'can a quote go out empty') is distinct from 2 then
    raise exception 'FAIL: the opened rank was not filled';
  end if;
end $$;
reset role;

-- ── Members read their workspace's rows, and nobody else's ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000006b1');
do $$
begin
  if pg_temp.seen() <> 2
     or exists (select 1 from public.mcp_search_log where workspace_id <> '00000000-0000-4000-8000-000000000610') then
    raise exception 'FAIL: Max, a member of Lantern, does not read Lamp''s two rows alone';
  end if;
end $$;
select pg_temp.refused($q$insert into public.mcp_search_log (product_id, workspace_id, tool, query, total)
  values ('00000000-0000-4000-8000-0000000006f1', '00000000-0000-4000-8000-000000000610', 'search_knowledge', 'x', 0)$q$,
  '42501', 'a member adding a row');
select pg_temp.refused($q$update public.mcp_search_log set opened_rank = 1, opened_id = 'BL-QUOTES-1'$q$,
  '42501', 'a member filling an opened rank');
select pg_temp.refused($q$delete from public.mcp_search_log$q$, '42501', 'a member deleting rows');
select pg_temp.refused($q$select public.mcp_search_log_forget()$q$, '42501', 'a member forgetting');
select pg_temp.sign_in('00000000-0000-4000-8000-0000000006a1');
do $$
begin
  if pg_temp.seen() <> 2 then raise exception 'FAIL: Lia, Lantern''s owner, reads % rows, not Lamp''s two', pg_temp.seen(); end if;
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000006c1');
do $$
begin
  if pg_temp.seen() <> 1 or (select query from public.mcp_search_log) is distinct from 'dock ledger' then
    raise exception 'FAIL: Hal, of Harbor, does not read Dock''s one row alone';
  end if;
end $$;
reset role;

set local role anon;
select pg_temp.refused($q$select * from public.mcp_search_log$q$, '42501', 'anon reading the log');
select pg_temp.refused($q$select public.mcp_search_log_forget()$q$, '42501', 'anon forgetting');
reset role;

-- ── Forget deletes the rows asked more than 90 days ago ──
-- Lamp's search was asked 91 days ago (goes), its get_knowledge 89 days ago (stays); Dock's 120 days ago (goes).
update public.mcp_search_log set asked_at = now() - interval '91 days' where query = 'can a quote go out empty';
update public.mcp_search_log set asked_at = now() - interval '89 days' where query = 'BL-QUOTES-2';
update public.mcp_search_log set asked_at = now() - interval '120 days' where query = 'dock ledger';
set local role service_role;
do $$
declare
  n integer := public.mcp_search_log_forget();
begin
  if n <> 2 then raise exception 'FAIL: forget deleted % rows, not the two older than 90 days', n; end if;
  if (select array_agg(query) from public.mcp_search_log) is distinct from array['BL-QUOTES-2'] then
    raise exception 'FAIL: forget did not keep the row asked 89 days ago alone';
  end if;
end $$;
reset role;

-- ── A product's rows go with it ──
delete from public.products where id = '00000000-0000-4000-8000-0000000006f1';
do $$
begin
  if exists (select 1 from public.mcp_search_log where product_id = '00000000-0000-4000-8000-0000000006f1') then
    raise exception 'FAIL: a deleted product''s rows survived it';
  end if;
end $$;

rollback;
