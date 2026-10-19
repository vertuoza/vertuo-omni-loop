-- Who may make, list and revoke an API key, and which key the /api/v1 routes accept (PRD 2022 s1,
-- 20261210090000_api_keys.sql). The supabase workflow runs it on every pull request, after
-- `supabase db start` has applied the migrations and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/api_keys.sql
-- Only a workspace's owner makes or revokes a key; a member lists the keys, never the hash; another
-- workspace's member and anyone signed out are refused (42501). A key's repositories must be ones the
-- workspace tracks (22023), its name unique among the workspace's live keys, and the workspace's 21st
-- live key is refused (54000). Only the hash and the last four characters are stored, and a hash is
-- unique. api_key_of() runs for the service role only, and answers a live key's workspace and
-- repositories; nothing for a revoked key, a key whose maker left the workspace, a business link or a
-- kit token. `last used` moves at most once a minute. A job may name the key that queued it.
--
-- One transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

-- ── The cast ──
-- Ada owns Northwind; Ben is its member, Cleo its second owner; Dan owns Southwind.
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000020a1', 'ada@northwind.test', now()),
  ('00000000-0000-4000-8000-0000000020b1', 'ben@northwind.test', now()),
  ('00000000-0000-4000-8000-0000000020a2', 'cleo@northwind.test', now()),
  ('00000000-0000-4000-8000-0000000020c1', 'dan@southwind.test', now());
insert into public.workspaces (slug, name, github_org) values
  ('northwind-keys', 'Northwind', 'northwind-keys'),
  ('southwind-keys', 'Southwind', 'southwind-keys');
insert into public.workspace_members (workspace_id, user_id, role)
select w.id, m.user_id, m.role
  from (values
         ('northwind-keys', '00000000-0000-4000-8000-0000000020a1'::uuid, 'owner'),
         ('northwind-keys', '00000000-0000-4000-8000-0000000020b1'::uuid, 'member'),
         ('northwind-keys', '00000000-0000-4000-8000-0000000020a2'::uuid, 'owner'),
         ('southwind-keys', '00000000-0000-4000-8000-0000000020c1'::uuid, 'owner')
       ) as m (slug, user_id, role)
  join public.workspaces w on w.slug = m.slug
on conflict (workspace_id, user_id) do nothing;
insert into public.repositories (workspace_id, full_name, tracked)
select w.id, r.full_name, r.tracked
  from (values
         ('northwind-keys', 'northwind-keys/backend', true),
         ('northwind-keys', 'northwind-keys/web', true),
         ('northwind-keys', 'northwind-keys/attic', false),
         ('southwind-keys', 'southwind-keys/backend', true)
       ) as r (slug, full_name, tracked)
  join public.workspaces w on w.slug = r.slug;

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.sign_out() returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
$$;
create temporary table ids (slug text primary key, id uuid);
insert into ids select w.slug, w.id from public.workspaces w where w.slug in ('northwind-keys', 'southwind-keys');
grant select on ids to anon, authenticated, service_role;
create function pg_temp.ws(slug text) returns uuid language sql as $$
  select i.id from ids i where i.slug = ws.slug;
$$;
-- The keys handed out, by name, kept for comparisons.
create temporary table kept (name text primary key, secret text, id uuid);
grant select, insert, update on kept to anon, authenticated, service_role;
create function pg_temp.hash(secret text) returns text language sql immutable as $$
  select encode(sha256(convert_to(secret, 'UTF8')), 'hex');
$$;
create function pg_temp.kept(name text) returns kept language sql as $$
  select k from kept k where k.name = kept.name;
$$;
-- Runs a call that must be refused with `state`.
create function pg_temp.refused(stmt text, state text) returns void language plpgsql as $$
declare got text;
begin
  begin
    execute stmt;
  exception when others then
    got := sqlstate;
  end;
  if got is distinct from state then
    raise exception 'FAIL: % answered % (want %)', stmt, coalesce(got, 'success'), state;
  end if;
end;
$$;
-- Makes a key as whoever is signed in, and keeps it under `name`.
create function pg_temp.make(name text, slug text, repos text[], secret text) returns uuid language plpgsql as $$
declare made uuid;
begin
  made := public.api_key_make(pg_temp.ws(slug), name, repos, pg_temp.hash(secret), right(secret, 4));
  insert into kept values (name, secret, made);
  return made;
end;
$$;

-- ── Signed out: no function runs, the table is not read ──
set local role anon;
select pg_temp.sign_out();
do $$
declare c text;
begin
  foreach c in array array[
    format('select public.api_key_make(%L, ''x'', ''{}'', %L, ''abcd'')', pg_temp.ws('northwind-keys'), repeat('a', 64)),
    format('select public.api_key_revoke(%L, gen_random_uuid())', pg_temp.ws('northwind-keys')),
    format('select public.api_keys_list(%L)', pg_temp.ws('northwind-keys')),
    format('select public.api_key_of(%L)', repeat('a', 64)),
    'select 1 from public.agent_tokens'
  ] loop perform pg_temp.refused(c, '42501'); end loop;
end $$;
reset role;

-- ── Only an owner makes a key ──
set local role authenticated;
do $$
declare made uuid;
begin
  -- Ben, a member, may not; nor may Dan, another workspace's owner.
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000020b1');
  perform pg_temp.refused(format('select public.api_key_make(%L, ''Ben''''s'', ''{}'', %L, ''abcd'')', pg_temp.ws('northwind-keys'), repeat('b', 64)), '42501');
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000020c1');
  perform pg_temp.refused(format('select public.api_key_make(%L, ''Dan''''s'', ''{}'', %L, ''abcd'')', pg_temp.ws('northwind-keys'), repeat('b', 64)), '42501');

  -- Ada makes one for every repository, and one limited to the backend, named in any case and order.
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000020a1');
  made := pg_temp.make('Weekly digest', 'northwind-keys', '{}', 'oma_WeeklyDigestAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA0001');
  if made is null then raise exception 'FAIL: making a key answered no id'; end if;
  perform pg_temp.make('QA dashboard', 'northwind-keys', array[' Northwind-Keys/Backend ', 'northwind-keys/backend'], 'oma_QaDashboardBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB0002');

  -- A name is 1 to 40 characters on one line, and unique among the workspace's live keys, whoever made it.
  perform pg_temp.refused(format('select public.api_key_make(%L, '''', ''{}'', %L, ''abcd'')', pg_temp.ws('northwind-keys'), repeat('c', 64)), '22023');
  perform pg_temp.refused(format('select public.api_key_make(%L, %L, ''{}'', %L, ''abcd'')', pg_temp.ws('northwind-keys'), repeat('n', 41), repeat('c', 64)), '22023');
  perform pg_temp.refused(format('select public.api_key_make(%L, %L, ''{}'', %L, ''abcd'')', pg_temp.ws('northwind-keys'), e'two\nlines', repeat('c', 64)), '22023');
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000020a2');
  perform pg_temp.refused(format('select public.api_key_make(%L, ''qa DASHBOARD'', ''{}'', %L, ''abcd'')', pg_temp.ws('northwind-keys'), repeat('c', 64)), '22023');
  -- The hash and the last four have their shapes.
  perform pg_temp.refused(format('select public.api_key_make(%L, ''ok'', ''{}'', ''not-a-hash'', ''abcd'')', pg_temp.ws('northwind-keys')), '22023');
  perform pg_temp.refused(format('select public.api_key_make(%L, ''ok'', ''{}'', %L, ''ab'')', pg_temp.ws('northwind-keys'), repeat('c', 64)), '22023');
  -- A hash is unique: the same secret twice is refused.
  perform pg_temp.refused(format('select public.api_key_make(%L, ''Copy'', ''{}'', %L, ''0002'')', pg_temp.ws('northwind-keys'), pg_temp.hash((pg_temp.kept('QA dashboard')).secret)), '23505');
end $$;
reset role;

-- ── Only repositories the workspace tracks ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000020a1');
do $$
declare c text;
begin
  foreach c in array array['northwind-keys/nowhere', 'southwind-keys/backend', 'northwind-keys/attic', 'not a repo', ''] loop
    perform pg_temp.refused(format('select public.api_key_make(%L, ''Stray'', %L, %L, ''abcd'')', pg_temp.ws('northwind-keys'),
      array['northwind-keys/web', c], repeat('d', 64)), '22023');
  end loop;
end $$;
reset role;

-- ── Only the hash, the last four and the repositories are stored ──
do $$
declare t public.agent_tokens;
begin
  -- Both were made in this one transaction: the digest is dated a day back, so the list's order shows.
  update public.agent_tokens set created_at = now() - interval '1 day' where id = (pg_temp.kept('Weekly digest')).id;
  select * into t from public.agent_tokens x where x.id = (pg_temp.kept('QA dashboard')).id;
  if t.scope <> 'api' or t.token_hash <> pg_temp.hash((pg_temp.kept('QA dashboard')).secret) or t.last_four <> '0002'
     or t.repos <> array['northwind-keys/backend'] or t.expires_at is not null or t.made_by <> '00000000-0000-4000-8000-0000000020a1' then
    raise exception 'FAIL: the key is not stored as its hash, last four and repositories: %', t;
  end if;
  if position((pg_temp.kept('QA dashboard')).secret in row(t.*)::text) > 0 then
    raise exception 'FAIL: the secret itself is stored';
  end if;
  if (select repos from public.agent_tokens where id = (pg_temp.kept('Weekly digest')).id) <> '{}' then
    raise exception 'FAIL: a key for every repository holds an allow-list';
  end if;
end $$;

-- ── Any member lists the keys, never the hash; another workspace's may not ──
set local role authenticated;
do $$
declare listed jsonb;
begin
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000020b1');
  listed := public.api_keys_list(pg_temp.ws('northwind-keys'));
  if jsonb_array_length(listed) <> 2 or listed->0->>'name' <> 'QA dashboard' or listed->1->>'name' <> 'Weekly digest'
     or listed->0->>'lastFour' <> '0002' or listed->0->'repos' <> '["northwind-keys/backend"]'::jsonb
     or listed->1->'repos' <> '[]'::jsonb or listed->0->>'lastUsedAt' is not null or listed->0->>'revokedAt' is not null
     or (listed->0->>'working')::boolean is not true
     or (listed->0->'maker'->>'id')::uuid <> '00000000-0000-4000-8000-0000000020a1' or listed->0->>'createdAt' is null then
    raise exception 'FAIL: Ben read the list as %', listed;
  end if;
  if listed::text like '%' || pg_temp.hash((pg_temp.kept('QA dashboard')).secret) || '%' or listed->0 ? 'hash' or listed->0 ? 'tokenHash' then
    raise exception 'FAIL: the list carries the hash';
  end if;
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000020c1');
  perform pg_temp.refused(format('select public.api_keys_list(%L)', pg_temp.ws('northwind-keys')), '42501');
  if public.api_keys_list(pg_temp.ws('southwind-keys')) <> '[]'::jsonb then
    raise exception 'FAIL: Southwind lists Northwind''s keys';
  end if;
end $$;
reset role;

-- ── The agent links' list shows no API key ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000020a1');
do $$
begin
  if public.agent_tokens_list(pg_temp.ws('northwind-keys')) <> '[]'::jsonb then
    raise exception 'FAIL: an API key is listed among the agent links';
  end if;
end $$;
reset role;

-- ── api_key_of(): the service role's only, a live key's workspace and repositories ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000020a1');
select pg_temp.refused(format('select public.api_key_of(%L)', pg_temp.hash((pg_temp.kept('QA dashboard')).secret)), '42501');
reset role;
set local role service_role;
do $$
declare got jsonb := public.api_key_of(pg_temp.hash((pg_temp.kept('QA dashboard')).secret));
begin
  if got is null or (got->>'key_id')::uuid <> (pg_temp.kept('QA dashboard')).id
     or (got->>'workspace_id')::uuid <> pg_temp.ws('northwind-keys') or got->'repos' <> '["northwind-keys/backend"]'::jsonb
     or (got->>'made_by')::uuid <> '00000000-0000-4000-8000-0000000020a1' or got->>'name' <> 'QA dashboard' then
    raise exception 'FAIL: api_key_of answered %', got;
  end if;
  if got ? 'token_hash' or got::text like '%' || pg_temp.hash((pg_temp.kept('QA dashboard')).secret) || '%' then
    raise exception 'FAIL: api_key_of answered the hash';
  end if;
  if public.api_key_of(pg_temp.hash((pg_temp.kept('Weekly digest')).secret))->'repos' <> '[]'::jsonb then
    raise exception 'FAIL: a key for every repository answered an allow-list';
  end if;
  -- An unknown, a malformed and a missing hash answer nothing.
  if public.api_key_of(pg_temp.hash('oma_nobody')) is not null or public.api_key_of('oma_plain') is not null
     or public.api_key_of(null) is not null then
    raise exception 'FAIL: api_key_of answered a key nobody made';
  end if;
end $$;
reset role;

-- ── api_key_names(): the service role's only, the workspace's API keys' names (issue 2165) ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000020a1');
select pg_temp.refused(format('select public.api_key_names(%L, %L)', pg_temp.ws('northwind-keys'), array[(pg_temp.kept('QA dashboard')).id]), '42501');
reset role;
set local role service_role;
do $$
declare
  qa uuid := (pg_temp.kept('QA dashboard')).id;
  got jsonb := public.api_key_names(pg_temp.ws('northwind-keys'), array[qa, gen_random_uuid()]);
begin
  if got <> jsonb_build_object(qa::text, 'QA dashboard') then
    raise exception 'FAIL: api_key_names answered %', got;
  end if;
  if public.api_key_names(gen_random_uuid(), array[qa]) <> '{}'::jsonb then
    raise exception 'FAIL: api_key_names answered a key of another workspace';
  end if;
  if public.api_key_names(pg_temp.ws('northwind-keys'), '{}') <> '{}'::jsonb then
    raise exception 'FAIL: api_key_names answered names for no key';
  end if;
end $$;
reset role;

-- ── `last used` moves at most once a minute ──
do $$
declare
  h text := pg_temp.hash((pg_temp.kept('QA dashboard')).secret);
  after timestamptz;
begin
  if (select last_used_at from public.agent_tokens where id = (pg_temp.kept('QA dashboard')).id) is null then
    raise exception 'FAIL: a call with the key left last used empty';
  end if;
  update public.agent_tokens set last_used_at = now() - interval '30 seconds' where id = (pg_temp.kept('QA dashboard')).id;
  perform public.api_key_of(h);
  select last_used_at into after from public.agent_tokens where id = (pg_temp.kept('QA dashboard')).id;
  if after <> now() - interval '30 seconds' then raise exception 'FAIL: last used moved within the minute'; end if;
  update public.agent_tokens set last_used_at = now() - interval '2 minutes' where id = (pg_temp.kept('QA dashboard')).id;
  perform public.api_key_of(h);
  select last_used_at into after from public.agent_tokens where id = (pg_temp.kept('QA dashboard')).id;
  if after <> now() then raise exception 'FAIL: last used did not move after a minute'; end if;
end $$;

-- ── A business link and a kit token are never an API key ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000020a1');
insert into kept select 'Editor', 'omb_AdaEditor', (public.agent_token_make(pg_temp.ws('northwind-keys'), 'Editor', pg_temp.hash('omb_AdaEditor'), 'itor')->>'id')::uuid;
select public.kit_token_make('northwind-keys', 'terminal', pg_temp.hash('omk_AdaTerminal'), 'inal', 30, 'sealed');
reset role;
set local role service_role;
do $$
begin
  if public.api_key_of(pg_temp.hash('omb_AdaEditor')) is not null then
    raise exception 'FAIL: api_key_of answered a business link';
  end if;
  if public.api_key_of(pg_temp.hash('omk_AdaTerminal')) is not null then
    raise exception 'FAIL: api_key_of answered a kit token';
  end if;
end $$;
reset role;
-- An API key never reads the business through an agent's link.
set local role anon;
select pg_temp.sign_out();
select pg_temp.refused(format('select public.business_for_token(%L)', pg_temp.hash((pg_temp.kept('QA dashboard')).secret)), '28000');
reset role;
-- Another scope never holds an allow-list.
do $$
begin
  perform pg_temp.refused(format('update public.agent_tokens set repos = ''{northwind-keys/web}'' where token_hash = %L', pg_temp.hash('omb_AdaEditor')), '23514');
  perform pg_temp.refused(format('update public.agent_tokens set scope = ''other'' where token_hash = %L', pg_temp.hash('omb_AdaEditor')), '23514');
end $$;

-- ── Only an owner revokes, and a revoked key stops at once ──
set local role authenticated;
do $$
declare got jsonb;
begin
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000020b1');
  perform pg_temp.refused(format('select public.api_key_revoke(%L, %L)', pg_temp.ws('northwind-keys'), (pg_temp.kept('Weekly digest')).id), '42501');
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000020c1');
  perform pg_temp.refused(format('select public.api_key_revoke(%L, %L)', pg_temp.ws('northwind-keys'), (pg_temp.kept('Weekly digest')).id), '42501');
  perform pg_temp.refused(format('select public.api_key_revoke(%L, %L)', pg_temp.ws('southwind-keys'), (pg_temp.kept('Weekly digest')).id), 'P0002');
  -- Cleo, the second owner, revokes Ada's key; an agent link is no API key to revoke here.
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000020a2');
  perform pg_temp.refused(format('select public.api_key_revoke(%L, %L)', pg_temp.ws('northwind-keys'),
    (pg_temp.kept('Editor')).id), 'P0002');
  got := public.api_key_revoke(pg_temp.ws('northwind-keys'), (pg_temp.kept('Weekly digest')).id);
  if (got->>'id')::uuid <> (pg_temp.kept('Weekly digest')).id or got->>'revokedAt' is null or got ? 'hash' then
    raise exception 'FAIL: revoking answered %', got;
  end if;
  -- Revoking it again changes nothing.
  if public.api_key_revoke(pg_temp.ws('northwind-keys'), (pg_temp.kept('Weekly digest')).id)->>'revokedAt' <> got->>'revokedAt' then
    raise exception 'FAIL: revoking twice moved revoked at';
  end if;
  if jsonb_array_length(public.api_keys_list(pg_temp.ws('northwind-keys'))) <> 1 then
    raise exception 'FAIL: the list still shows a revoked key';
  end if;
end $$;
reset role;
do $$
declare t public.agent_tokens;
begin
  select * into t from public.agent_tokens where id = (pg_temp.kept('Weekly digest')).id;
  if t.revoked_at is null or t.revoked_by <> '00000000-0000-4000-8000-0000000020a2' then
    raise exception 'FAIL: the revoked key was not kept with who revoked it: %', t;
  end if;
end $$;
set local role service_role;
do $$
begin
  if public.api_key_of(pg_temp.hash((pg_temp.kept('Weekly digest')).secret)) is not null then
    raise exception 'FAIL: api_key_of answered a revoked key';
  end if;
end $$;
reset role;

-- ── A revoked name may be used again; the workspace's 21st live key is refused, whoever makes it ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000020a1');
do $$
declare i integer;
begin
  perform public.api_key_make(pg_temp.ws('northwind-keys'), 'Weekly digest', '{northwind-keys/web}', pg_temp.hash('oma_weekly_again'), 'gain');
  -- Northwind holds 2 live keys: 9 more by Ada and 9 by Cleo make 20.
  for i in 1..9 loop
    perform public.api_key_make(pg_temp.ws('northwind-keys'), 'Ada ' || i, '{}', pg_temp.hash('oma_ada_' || i), lpad(i::text, 4, '0'));
  end loop;
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000020a2');
  for i in 1..9 loop
    perform public.api_key_make(pg_temp.ws('northwind-keys'), 'Cleo ' || i, '{}', pg_temp.hash('oma_cleo_' || i), lpad(i::text, 4, '0'));
  end loop;
  perform pg_temp.refused(format('select public.api_key_make(%L, ''One too many'', ''{}'', %L, ''abcd'')', pg_temp.ws('northwind-keys'), pg_temp.hash('oma_21')), '54000');
  -- Another workspace's keys are counted apart.
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000020c1');
  perform pg_temp.make('Southwind tool', 'southwind-keys', '{southwind-keys/backend}', 'oma_SouthwindDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD0004');
end $$;
reset role;

-- ── A job may name the key that queued it ──
do $$
declare
  job uuid;
  person uuid;
begin
  insert into public.runner_jobs (workspace_id, line, repo, sent_by)
  values (pg_temp.ws('northwind-keys'), '/omni:bug-fix ''the date is wrong''', 'northwind-keys/web', '00000000-0000-4000-8000-0000000020b1')
  returning id into person;
  insert into public.runner_jobs (workspace_id, line, repo, sent_by, sent_by_key)
  values (pg_temp.ws('northwind-keys'), '/omni:bug-fix ''the total is wrong''', 'northwind-keys/backend',
          '00000000-0000-4000-8000-0000000020a1', (pg_temp.kept('QA dashboard')).id)
  returning id into job;
  if (select sent_by_key from public.runner_jobs where id = job) <> (pg_temp.kept('QA dashboard')).id then
    raise exception 'FAIL: a job did not keep the key that queued it';
  end if;
  if (select sent_by_key from public.runner_jobs where id = person) is not null then
    raise exception 'FAIL: a person''s job names a key';
  end if;
end $$;

-- ── A key whose maker left the workspace stops, and is listed as not working ──
delete from public.workspace_members
 where workspace_id = pg_temp.ws('northwind-keys') and user_id = '00000000-0000-4000-8000-0000000020a1';
set local role service_role;
do $$
begin
  if public.api_key_of(pg_temp.hash((pg_temp.kept('QA dashboard')).secret)) is not null then
    raise exception 'FAIL: api_key_of answered a key whose maker left';
  end if;
  if public.api_key_of(pg_temp.hash('oma_cleo_1')) is null then
    raise exception 'FAIL: a key of a member who stayed stopped';
  end if;
end $$;
reset role;
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000020a2');
do $$
declare listed jsonb := public.api_keys_list(pg_temp.ws('northwind-keys'));
begin
  if jsonb_array_length(listed) <> 20
     or exists (select 1 from jsonb_array_elements(listed) e
                 where (e->>'working')::boolean <> ((e->'maker'->>'id')::uuid = '00000000-0000-4000-8000-0000000020a2')) then
    raise exception 'FAIL: the keys of a person who left are not listed as not working: %', listed;
  end if;
  -- An owner revokes one left behind; Ada, who left, may not.
  perform public.api_key_revoke(pg_temp.ws('northwind-keys'), (pg_temp.kept('QA dashboard')).id);
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000020a1');
  perform pg_temp.refused(format('select public.api_key_revoke(%L, %L)', pg_temp.ws('northwind-keys'), (pg_temp.kept('Weekly digest')).id), '42501');
end $$;
reset role;

select 'api_keys: every check passed' as result;

rollback;
