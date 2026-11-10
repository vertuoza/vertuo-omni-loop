-- A product's MCP server: who switches it, and what an API key reads through it (PRD 2707 s2,
-- 20270114090000_product_mcp.sql). The supabase workflow runs it on every pull request, after
-- `supabase db start` has applied the migrations and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/product_mcp.sql
-- A product's server is off until an owner of its workspace turns it on with product_mcp_set(); a member,
-- another workspace's owner and anyone signed out are refused (42501), an archived product refuses (P0002).
-- product_mcp_for_key() runs for the service role only, and answers a product only for a live API key of
-- the product's own workspace (BR-PRODUCT-63) whose maker is still a member (BR-PRODUCT-64, BL-ACCESS-1),
-- while the server is on and the product is not archived: nothing for a server that is off, an unknown
-- key, another workspace's key, a revoked key, a key whose maker left (on the very next call), a business
-- link or a malformed value. A key's allow-list naming none of the product's repositories reads nothing,
-- one naming some reads only those, and an empty one reads them all; each repository answers its newest
-- pack, or none yet. One transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

-- ── The cast ──
-- Lia owns Lantern, Ned is its second owner, Max a member; Hal owns Harbor. Lantern sells Lamp (key lamp,
-- in lantern/lamp-api and lantern/lamp-web, its plan repository lamp-api) and Wick (key wick, in
-- lantern/wick). Harbor sells Dock (key dock, in harbor/dock).
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000027070a1', 'lia@lantern.test'),
  ('00000000-0000-4000-8000-0000027070a2', 'ned@lantern.test'),
  ('00000000-0000-4000-8000-0000027070b1', 'max@lantern.test'),
  ('00000000-0000-4000-8000-0000027070c1', 'hal@harbor.test');
insert into public.workspaces (id, slug, name, github_org) values
  ('00000000-0000-4000-8000-000002707100', 'lantern-mcp', 'Lantern', 'lantern'),
  ('00000000-0000-4000-8000-000002707200', 'harbor-mcp', 'Harbor', 'harbor');
insert into public.workspace_members (workspace_id, user_id, role) values
  ('00000000-0000-4000-8000-000002707100', '00000000-0000-4000-8000-0000027070a1', 'owner'),
  ('00000000-0000-4000-8000-000002707100', '00000000-0000-4000-8000-0000027070a2', 'owner'),
  ('00000000-0000-4000-8000-000002707100', '00000000-0000-4000-8000-0000027070b1', 'member'),
  ('00000000-0000-4000-8000-000002707200', '00000000-0000-4000-8000-0000027070c1', 'owner')
on conflict (workspace_id, user_id) do nothing;
insert into public.businesses (workspace_id, name) values
  ('00000000-0000-4000-8000-000002707100', 'Lantern'),
  ('00000000-0000-4000-8000-000002707200', 'Harbor');
insert into public.repositories (workspace_id, full_name, tracked) values
  ('00000000-0000-4000-8000-000002707100', 'lantern/lamp-api', true),
  ('00000000-0000-4000-8000-000002707100', 'lantern/lamp-web', true),
  ('00000000-0000-4000-8000-000002707100', 'lantern/wick', true),
  ('00000000-0000-4000-8000-000002707200', 'harbor/dock', true);
insert into public.products (id, workspace_id, business_id, name, key)
select x.id::uuid, b.workspace_id, b.id, x.name, x.key
  from (values ('00000000-0000-4000-8000-000002707100', '00000000-0000-4000-8000-0000027071f1', 'Lamp', 'lamp'),
               ('00000000-0000-4000-8000-000002707100', '00000000-0000-4000-8000-0000027071f2', 'Wick', 'wick'),
               ('00000000-0000-4000-8000-000002707200', '00000000-0000-4000-8000-0000027072f1', 'Dock', 'dock'))
       as x (ws, id, name, key)
  join public.businesses b on b.workspace_id = x.ws::uuid;
insert into public.product_repositories (product_id, workspace_id, repository, added_by) values
  ('00000000-0000-4000-8000-0000027071f1', '00000000-0000-4000-8000-000002707100', 'lantern/lamp-api', 'person'),
  ('00000000-0000-4000-8000-0000027071f1', '00000000-0000-4000-8000-000002707100', 'lantern/lamp-web', 'person'),
  ('00000000-0000-4000-8000-0000027071f2', '00000000-0000-4000-8000-000002707100', 'lantern/wick', 'person'),
  ('00000000-0000-4000-8000-0000027072f1', '00000000-0000-4000-8000-000002707200', 'harbor/dock', 'person');
update public.products set plan_repository = 'lantern/lamp-api' where id = '00000000-0000-4000-8000-0000027071f1';
-- Lamp's knowledge as the agent link reads it (product_knowledge_for_agents(), PRD 2707 s3): a Legal entry
-- owned by Lia, whose player plays as lia-gh, a retired one, and a term. Dock has a Legal entry of its own.
insert into public.teams (workspace_id, name, label, color, home, sort) values
  ('00000000-0000-4000-8000-000002707100', 'wicks', 'WICKS', '#3355ff', null, 10);
insert into public.players (workspace_id, user_id, display_name, team, hero, github_login) values
  ('00000000-0000-4000-8000-000002707100', '00000000-0000-4000-8000-0000027070a1', 'LIA', 'wicks',
   '{"v":1,"body":"girl","skin":2,"hair":3,"suit":0,"cape":8}', 'lia-gh');
insert into public.product_legal (workspace_id, product_id, code, number, statement, source, owner_id, retired_at) values
  ('00000000-0000-4000-8000-000002707100', '00000000-0000-4000-8000-0000027071f1', 'GDPR', 2,
   'Credentials are never stored in clear.', 'https://law.example/gdpr-32', '00000000-0000-4000-8000-0000027070a1', null),
  ('00000000-0000-4000-8000-000002707100', '00000000-0000-4000-8000-0000027071f1', 'GDPR', 1,
   'A retired entry.', 'https://law.example/gdpr-5', null, now()),
  ('00000000-0000-4000-8000-000002707200', '00000000-0000-4000-8000-0000027072f1', 'DOCK', 1,
   'A dock keeps its ledger.', 'https://law.example/dock', '00000000-0000-4000-8000-0000027070c1', null);
insert into public.product_glossary (workspace_id, product_id, term, meaning, avoid) values
  ('00000000-0000-4000-8000-000002707100', '00000000-0000-4000-8000-0000027071f1', 'Wick', 'The part of a lamp that burns.', '{string}');

create function pg_temp.hash(secret text) returns text language sql immutable as $$
  select encode(sha256(convert_to(secret, 'UTF8')), 'hex');
$$;
create function pg_temp.sha(c text) returns text language sql immutable as $$
  select repeat(c, 40);
$$;
-- The keys, made as their makers would (api_key_make() is proven by api_keys.sql), and a business link.
insert into public.agent_tokens (workspace_id, made_by, name, token_hash, last_four, scope, repos) values
  ('00000000-0000-4000-8000-000002707100', '00000000-0000-4000-8000-0000027070a1', 'Every repo',
   pg_temp.hash('oma_lantern_every_0001'), '0001', 'api', '{}'),
  ('00000000-0000-4000-8000-000002707100', '00000000-0000-4000-8000-0000027070a1', 'Api only',
   pg_temp.hash('oma_lantern_apionly_0002'), '0002', 'api', '{lantern/lamp-api,lantern/wick}'),
  ('00000000-0000-4000-8000-000002707100', '00000000-0000-4000-8000-0000027070a1', 'Wick only',
   pg_temp.hash('oma_lantern_wickonly_0003'), '0003', 'api', '{lantern/wick}'),
  ('00000000-0000-4000-8000-000002707100', '00000000-0000-4000-8000-0000027070a2', 'Ned''s',
   pg_temp.hash('oma_lantern_ned_0004'), '0004', 'api', '{}'),
  ('00000000-0000-4000-8000-000002707200', '00000000-0000-4000-8000-0000027070c1', 'Harbor',
   pg_temp.hash('oma_harbor_every_0005'), '0005', 'api', '{}'),
  ('00000000-0000-4000-8000-000002707100', '00000000-0000-4000-8000-0000027070a1', 'Lia link',
   pg_temp.hash('omb_lantern_link_0006'), '0006', 'business', '{}');
insert into public.agent_tokens (workspace_id, made_by, name, token_hash, last_four, scope, repos, revoked_at, revoked_by) values
  ('00000000-0000-4000-8000-000002707100', '00000000-0000-4000-8000-0000027070a1', 'Revoked',
   pg_temp.hash('oma_lantern_revoked_0007'), '0007', 'api', '{}', now(), '00000000-0000-4000-8000-0000027070a1');

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.sign_out() returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
$$;
-- Runs a call that must be refused with `code`.
create function pg_temp.refused(stmt text, code text, why text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % ran: %', why, stmt;
exception when others then
  if sqlstate <> code then raise exception 'FAIL: % answered % (%), not %', why, sqlstate, sqlerrm, code; end if;
end;
$$;
-- What a key reads of a product through its MCP server, as the route would ask.
create function pg_temp.reads(secret text, product text) returns jsonb language sql as $$
  select public.product_mcp_for_key(pg_temp.hash(secret), product);
$$;
grant execute on function pg_temp.hash(text) to anon, authenticated, service_role;
grant execute on function pg_temp.sha(text) to service_role;
grant execute on function pg_temp.refused(text, text, text) to anon, authenticated, service_role;
grant execute on function pg_temp.reads(text, text) to service_role;

-- ── Who may call what ──
do $$
begin
  if has_function_privilege('anon', 'public.product_mcp_set(uuid, boolean)', 'execute')
     or not has_function_privilege('authenticated', 'public.product_mcp_set(uuid, boolean)', 'execute') then
    raise exception 'FAIL: product_mcp_set() is not for the signed in alone';
  end if;
  if has_function_privilege('anon', 'public.product_mcp_for_key(text, text)', 'execute')
     or has_function_privilege('authenticated', 'public.product_mcp_for_key(text, text)', 'execute')
     or not has_function_privilege('service_role', 'public.product_mcp_for_key(text, text)', 'execute') then
    raise exception 'FAIL: product_mcp_for_key() is not the service role''s alone';
  end if;
  if has_column_privilege('authenticated', 'public.products', 'mcp_enabled', 'update') then
    raise exception 'FAIL: a signed-in person writes mcp_enabled without the function';
  end if;
  if not has_column_privilege('authenticated', 'public.products', 'mcp_enabled', 'select') then
    raise exception 'FAIL: a member cannot read whether the server is on';
  end if;
end $$;

-- ── Off by default ──
do $$
begin
  if exists (select 1 from public.products where mcp_enabled) then
    raise exception 'FAIL: a product''s MCP server is on before anyone turned it on';
  end if;
end $$;
set local role service_role;
do $$
begin
  if pg_temp.reads('oma_lantern_every_0001', 'lamp') is not null then
    raise exception 'FAIL: a product never turned on answers a key';
  end if;
end $$;
reset role;

-- ── Only an owner switches it ──
set local role anon;
select pg_temp.sign_out();
select pg_temp.refused($q$select public.product_mcp_set('00000000-0000-4000-8000-0000027071f1', true)$q$, '42501', 'signed out');
reset role;
set local role authenticated;
do $$
declare got boolean;
begin
  -- Max, a member, may not; nor may Hal, another workspace's owner.
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000027070b1');
  perform pg_temp.refused($q$select public.product_mcp_set('00000000-0000-4000-8000-0000027071f1', true)$q$, '42501', 'a member');
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000027070c1');
  perform pg_temp.refused($q$select public.product_mcp_set('00000000-0000-4000-8000-0000027071f1', true)$q$, '42501', 'another workspace''s owner');
  -- Lia turns Lamp on; twice changes nothing.
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000027070a1');
  perform pg_temp.refused($q$select public.product_mcp_set(gen_random_uuid(), true)$q$, 'P0002', 'no such product');
  perform pg_temp.refused($q$select public.product_mcp_set('00000000-0000-4000-8000-0000027071f1', null)$q$, '22023', 'neither on nor off');
  got := public.product_mcp_set('00000000-0000-4000-8000-0000027071f1', true);
  if got is not true then raise exception 'FAIL: turning on answered %', got; end if;
  got := public.product_mcp_set('00000000-0000-4000-8000-0000027071f1', true);
  if got is not true then raise exception 'FAIL: turning on twice answered %', got; end if;
  -- A member reads the state with the product.
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000027070b1');
  if (select mcp_enabled from public.products where id = '00000000-0000-4000-8000-0000027071f1') is not true then
    raise exception 'FAIL: a member does not read that the server is on';
  end if;
  -- Hal turns his own Dock on; Lia's Wick stays off.
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000027070c1');
  perform public.product_mcp_set('00000000-0000-4000-8000-0000027072f1', true);
end $$;
reset role;

-- ── An archived product refuses the switch, and reads nothing ──
update public.products set mcp_enabled = true, archived_at = now(), archived_by = '00000000-0000-4000-8000-0000027070a1'
 where id = '00000000-0000-4000-8000-0000027071f2';
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000027070a1');
select pg_temp.refused($q$select public.product_mcp_set('00000000-0000-4000-8000-0000027071f2', false)$q$, 'P0002', 'an archived product');
reset role;
set local role service_role;
do $$
begin
  if pg_temp.reads('oma_lantern_every_0001', 'wick') is not null then
    raise exception 'FAIL: an archived product answers a key';
  end if;
end $$;
reset role;
do $$
begin
  if (select mcp_enabled from public.products where id = '00000000-0000-4000-8000-0000027071f2') is not true then
    raise exception 'FAIL: the refused switch changed an archived product';
  end if;
end $$;

-- ── The packs: lamp-api has one, lamp-web none yet ──
set local role service_role;
do $$
begin
  perform public.knowledge_pack_put('lantern/lamp-api', pg_temp.sha('a'), '2027-01-10 09:00+00',
    jsonb_build_array(jsonb_build_object('path', '.omni-loop/knowledge/adr/0001-first.md', 'content', E'# ADR-0001 First\n')));
end $$;
reset role;

-- ── A live key of the workspace reads the product, every repository with its newest pack ──
set local role service_role;
do $$
declare
  got jsonb := pg_temp.reads('oma_lantern_every_0001', 'lamp');
  pack uuid := (select id from public.knowledge_packs where repository = 'lantern/lamp-api' and newest);
begin
  if got is null then raise exception 'FAIL: a live key of the workspace read nothing'; end if;
  if got->'product' <> jsonb_build_object('id', '00000000-0000-4000-8000-0000027071f1', 'key', 'lamp', 'name', 'Lamp',
                                          'workspace_id', '00000000-0000-4000-8000-000002707100') then
    raise exception 'FAIL: the product read as %', got->'product';
  end if;
  if jsonb_array_length(got->'repositories') <> 2
     or got->'repositories'->0->>'repo' <> 'lantern/lamp-api' or (got->'repositories'->0->>'pack_id')::uuid <> pack
     or got->'repositories'->0->>'sha' <> pg_temp.sha('a') or (got->'repositories'->0->>'committed_at')::timestamptz <> '2027-01-10 09:00+00'
     or got->'repositories'->1 <> jsonb_build_object('repo', 'lantern/lamp-web', 'pack_id', null, 'sha', null, 'committed_at', null) then
    raise exception 'FAIL: the repositories read as %', got->'repositories';
  end if;
  if got->'law_home' <> jsonb_build_object('repo', 'lantern/lamp-api', 'pack_id', pack, 'sha', pg_temp.sha('a'),
                                            'committed_at', got->'repositories'->0->'committed_at') then
    raise exception 'FAIL: the law home read as %', got->'law_home';
  end if;
  if got::text like '%' || pg_temp.hash('oma_lantern_every_0001') || '%' then
    raise exception 'FAIL: the answer carries the key''s hash';
  end if;
  -- The product's knowledge, as the agent link reads it: live Legal entries with their owner's login, the Glossary.
  if got->'knowledge'->'legal' is distinct from jsonb_build_array(jsonb_build_object('id', 'L-GDPR-2',
       'statement', 'Credentials are never stored in clear.', 'source', 'https://law.example/gdpr-32', 'owner', 'lia-gh')) then
    raise exception 'FAIL: the Legal entries read as %', got->'knowledge'->'legal';
  end if;
  if got->'knowledge'->'glossary'->0->>'term' is distinct from 'Wick' or jsonb_array_length(got->'knowledge'->'glossary') is distinct from 1 then
    raise exception 'FAIL: the Glossary read as %', got->'knowledge'->'glossary';
  end if;
  if got::text like '%lia@lantern.test%' then
    raise exception 'FAIL: the answer carries an email';
  end if;
  -- The key reads, whatever the case of the product's key; it wrote last used.
  if pg_temp.reads('oma_lantern_every_0001', 'LAMP')->'product'->>'key' <> 'lamp' then
    raise exception 'FAIL: the product''s key read in capitals answered nothing';
  end if;
end $$;
reset role;
do $$
begin
  if (select last_used_at from public.agent_tokens where token_hash = pg_temp.hash('oma_lantern_every_0001')) is null then
    raise exception 'FAIL: a call left the key''s last used empty';
  end if;
  -- The knowledge is exactly the agent link's read of the product.
  if (pg_temp.reads('oma_lantern_every_0001', 'lamp')->'knowledge') is null or pg_temp.reads('oma_lantern_every_0001', 'lamp')->'knowledge'
     <> public.product_knowledge_for_agents('00000000-0000-4000-8000-0000027071f1') then
    raise exception 'FAIL: the knowledge is not the agent link''s read';
  end if;
end $$;

-- ── A newer pack is read on the very next call ──
set local role service_role;
do $$
declare got jsonb;
begin
  perform public.knowledge_pack_put('lantern/lamp-api', pg_temp.sha('b'), '2027-01-11 09:00+00',
    jsonb_build_array(jsonb_build_object('path', '.omni-loop/knowledge/adr/0001-first.md', 'content', E'# ADR-0001 First, amended\n')));
  got := pg_temp.reads('oma_lantern_every_0001', 'lamp');
  if got->'repositories'->0->>'sha' <> pg_temp.sha('b') or got->'law_home'->>'sha' <> pg_temp.sha('b') then
    raise exception 'FAIL: the newest pack is not the one read: %', got;
  end if;
end $$;
reset role;

-- ── The allow-list: some reads only those, none reads nothing ──
set local role service_role;
do $$
declare got jsonb := pg_temp.reads('oma_lantern_apionly_0002', 'lamp');
begin
  if got is null or jsonb_array_length(got->'repositories') <> 1 or got->'repositories'->0->>'repo' <> 'lantern/lamp-api' then
    raise exception 'FAIL: a key limited to lamp-api read %', got->'repositories';
  end if;
  -- The product's own knowledge stays whole: its law home is read, whatever the list.
  if got->'law_home'->>'repo' <> 'lantern/lamp-api' then
    raise exception 'FAIL: a limited key lost the law home: %', got->'law_home';
  end if;
  if pg_temp.reads('oma_lantern_wickonly_0003', 'lamp') is not null then
    raise exception 'FAIL: a key naming none of the product''s repositories read it';
  end if;
end $$;
reset role;

-- ── Another workspace's key reads nothing; its own product answers it ──
set local role service_role;
do $$
begin
  if pg_temp.reads('oma_harbor_every_0005', 'lamp') is not null then
    raise exception 'FAIL: another workspace''s key read Lamp';
  end if;
  if pg_temp.reads('oma_lantern_every_0001', 'dock') is not null then
    raise exception 'FAIL: Lantern''s key read Harbor''s Dock';
  end if;
  if pg_temp.reads('oma_harbor_every_0005', 'dock')->'product'->>'key' <> 'dock' then
    raise exception 'FAIL: Harbor''s key does not read its own Dock';
  end if;
  -- Each key reads the Legal entries of the product it reaches, never another's.
  if pg_temp.reads('oma_harbor_every_0005', 'dock')->'knowledge'->'legal'->0->>'id' is distinct from 'L-DOCK-1'
     or pg_temp.reads('oma_harbor_every_0005', 'dock')::text like '%L-GDPR-2%' then
    raise exception 'FAIL: Dock''s Legal entries read as %', pg_temp.reads('oma_harbor_every_0005', 'dock')->'knowledge'->'legal';
  end if;
  -- Dock has no plan repository and one repository: that one is its law home, with no pack yet.
  if pg_temp.reads('oma_harbor_every_0005', 'dock')->'law_home'
     <> jsonb_build_object('repo', 'harbor/dock', 'pack_id', null, 'sha', null, 'committed_at', null) then
    raise exception 'FAIL: Dock''s law home read as %', pg_temp.reads('oma_harbor_every_0005', 'dock')->'law_home';
  end if;
end $$;
reset role;

-- ── Keys that do not work, and values out of shape, read nothing ──
set local role service_role;
do $$
begin
  if pg_temp.reads('oma_lantern_revoked_0007', 'lamp') is not null then raise exception 'FAIL: a revoked key read'; end if;
  if pg_temp.reads('omb_lantern_link_0006', 'lamp') is not null then raise exception 'FAIL: a business link read'; end if;
  if pg_temp.reads('oma_nobody_made_this', 'lamp') is not null then raise exception 'FAIL: an unknown key read'; end if;
  if pg_temp.reads('oma_lantern_every_0001', 'nope') is not null then raise exception 'FAIL: an unknown product answered'; end if;
  if pg_temp.reads('oma_lantern_every_0001', 'Not a key!') is not null then raise exception 'FAIL: a malformed product answered'; end if;
  if public.product_mcp_for_key('not-a-hash', 'lamp') is not null
     or public.product_mcp_for_key(null, 'lamp') is not null
     or public.product_mcp_for_key(pg_temp.hash('oma_lantern_every_0001'), null) is not null then
    raise exception 'FAIL: a malformed or missing value answered';
  end if;
end $$;
reset role;

-- ── Signed in or out, nobody but the service role reads through the function ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000027070a1');
select pg_temp.refused(format('select public.product_mcp_for_key(%L, ''lamp'')', pg_temp.hash('oma_lantern_every_0001')), '42501', 'an owner signed in');
reset role;
set local role anon;
select pg_temp.sign_out();
select pg_temp.refused(format('select public.product_mcp_for_key(%L, ''lamp'')', pg_temp.hash('oma_lantern_every_0001')), '42501', 'signed out');
reset role;

-- ── A key whose maker left reads nothing on the very next call ──
set local role service_role;
do $$
begin
  if pg_temp.reads('oma_lantern_ned_0004', 'lamp') is null then
    raise exception 'FAIL: Ned''s key read nothing while he is a member';
  end if;
end $$;
reset role;
delete from public.workspace_members
 where workspace_id = '00000000-0000-4000-8000-000002707100' and user_id = '00000000-0000-4000-8000-0000027070a2';
set local role service_role;
do $$
begin
  if pg_temp.reads('oma_lantern_ned_0004', 'lamp') is not null then
    raise exception 'FAIL: a key whose maker left still reads';
  end if;
  if pg_temp.reads('oma_lantern_every_0001', 'lamp') is null then
    raise exception 'FAIL: a key of a member who stayed stopped';
  end if;
end $$;
reset role;

-- ── Turned off, the next call reads nothing ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000027070a1');
do $$
begin
  if public.product_mcp_set('00000000-0000-4000-8000-0000027071f1', false) is not false then
    raise exception 'FAIL: turning off did not answer off';
  end if;
end $$;
reset role;
set local role service_role;
do $$
begin
  if pg_temp.reads('oma_lantern_every_0001', 'lamp') is not null then
    raise exception 'FAIL: a product turned off still answers';
  end if;
end $$;
reset role;

select 'product_mcp: every check passed' as result;

rollback;
