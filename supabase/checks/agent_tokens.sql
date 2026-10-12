-- Who may make, list and revoke an agent's link, and what the link reads (PRD 855 s1,
-- 20261028090000_agent_tokens.sql). The supabase workflow runs it on every pull request, after
-- `supabase db start` has applied the migrations and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/agent_tokens.sql
-- Any member makes a link for themselves and lists the workspace's links; only its maker or an owner
-- revokes one; another workspace's member and anyone signed out are refused (42501). Only the token's
-- hash and last four characters are stored, and the list never carries the hash. A made link reads its
-- workspace's business for anyone holding it, exactly as business_for_repo() answers a member for the
-- same repository; without a repository, the only product, or no product when there are several
-- (PRD 1364; it refused with 22023 before). A link never reads another workspace's repository (42501). A revoked link, an
-- unknown one and one whose maker left the workspace are refused (28000). A person's 21st live link is
-- refused (54000). `last used` moves at most once a minute.
--
-- Kit tokens (PRD 1628 s1, 20261204090000_kit_tokens.sql): the sign-in round trip makes one acting as
-- its fresh session, for 30, 90 or 365 days, stored as its hash, its last four and its sealed session;
-- the 20 limit counts both scopes; only the service role claims a token's session, renews it under a
-- lease (`busy` while another exchange holds it) and releases it; a revoked, an expired and an
-- ex-member's token are each refused with its reason, a business link is `unknown` to the exchange, and
-- a kit token is refused by business_for_token(); revoking, by the maker or an owner, clears the
-- session; no member reads `session`, and the lists show a kit token to its maker and an owner only.
--
-- One transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

-- ── The cast ──
-- Olga owns Vertuoza; Mo and Nia are its members; Carl owns Acme.
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000085a1', 'olga@vertuoza.com', now()),
  ('00000000-0000-4000-8000-0000000085b1', 'mo@vertuoza.com', now()),
  ('00000000-0000-4000-8000-0000000085b2', 'nia@vertuoza.com', now()),
  ('00000000-0000-4000-8000-0000000085c1', 'carl@acme.test', now());
insert into public.workspaces (slug, name, github_org) values ('acme-links', 'Acme', 'acme-links');
update public.workspaces set github_org = 'vertuoza' where slug = 'vertuoza' and github_org is null;
insert into public.workspace_members (workspace_id, user_id, role)
select w.id, m.user_id, m.role
  from (values
         ('vertuoza', '00000000-0000-4000-8000-0000000085a1'::uuid, 'owner'),
         ('vertuoza', '00000000-0000-4000-8000-0000000085b1'::uuid, 'member'),
         ('vertuoza', '00000000-0000-4000-8000-0000000085b2'::uuid, 'member'),
         ('acme-links', '00000000-0000-4000-8000-0000000085c1'::uuid, 'owner')
       ) as m (slug, user_id, role)
  join public.workspaces w on w.slug = m.slug
on conflict (workspace_id, user_id) do nothing;
insert into public.repositories (workspace_id, full_name)
select w.id, 'acme-links/widgets' from public.workspaces w where w.slug = 'acme-links';

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.sign_out() returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
$$;
create temporary table ids (slug text primary key, id uuid);
insert into ids select w.slug, w.id from public.workspaces w where w.slug in ('vertuoza', 'acme-links');
grant select on ids to anon, authenticated, service_role;
create function pg_temp.ws(slug text) returns uuid language sql as $$
  select i.id from ids i where i.slug = ws.slug;
$$;
-- The tokens handed out, by name, and what a member read, kept for comparisons.
create temporary table kept (name text primary key, token text, id uuid, body jsonb);
grant select, insert, update on kept to anon, authenticated, service_role;
create function pg_temp.hash(token text) returns text language sql immutable as $$
  select encode(sha256(convert_to(token, 'UTF8')), 'hex');
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

-- ── Signed out: no member function runs, the table is not read ──
set local role anon;
select pg_temp.sign_out();
do $$
declare c text;
begin
  foreach c in array array[
    format('select public.agent_token_make(%L, ''x'', %L, ''abcd'')', pg_temp.ws('vertuoza'), repeat('a', 64)),
    format('select public.agent_token_revoke(%L, gen_random_uuid())', pg_temp.ws('vertuoza')),
    format('select public.agent_tokens_list(%L)', pg_temp.ws('vertuoza')),
    'select 1 from public.agent_tokens'
  ] loop perform pg_temp.refused(c, '42501'); end loop;
end $$;
reset role;

-- ── Mo opens the business, picks a little, and makes a link ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000085b1');
do $$
declare
  first uuid;
  made jsonb;
  tok text := 'omb_MoEditorTokenAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA0001';
begin
  perform public.business_open(pg_temp.ws('vertuoza'));
  select p.id into first from public.products p join public.businesses b on b.id = p.business_id
   where b.workspace_id = pg_temp.ws('vertuoza');
  perform public.claim_pick(pg_temp.ws('vertuoza'), null, 'region', 'Belgium', 'pick');
  perform public.claim_pick(pg_temp.ws('vertuoza'), first, 'offering', 'ERP', 'pick');
  perform public.claim_pick(pg_temp.ws('vertuoza'), first, 'rival', 'Rival Maybe', 'suggestion');

  made := public.agent_token_make(pg_temp.ws('vertuoza'), ' Mo''s editor ', pg_temp.hash(tok), right(tok, 4));
  if made->>'name' <> 'Mo''s editor' or made->>'lastFour' <> '0001' or (made->>'mine')::boolean is not true
     or (made->>'canRevoke')::boolean is not true or made->>'lastUsedAt' is not null or made ? 'hash' or made ? 'tokenHash' then
    raise exception 'FAIL: a made link answered %', made;
  end if;
  insert into kept values ('mo', tok, (made->>'id')::uuid, public.business_for_repo('vertuoza/vertuo-apps'));
  if (pg_temp.kept('mo')).body->>'state' <> 'ok' then
    raise exception 'FAIL: the member read no business: %', (pg_temp.kept('mo')).body;
  end if;

  -- A name is unique among Mo's live links, and 1 to 40 characters.
  perform pg_temp.refused(format('select public.agent_token_make(%L, ''mo''''s EDITOR'', %L, ''abcd'')', pg_temp.ws('vertuoza'), repeat('b', 64)), '22023');
  perform pg_temp.refused(format('select public.agent_token_make(%L, '''', %L, ''abcd'')', pg_temp.ws('vertuoza'), repeat('b', 64)), '22023');
  perform pg_temp.refused(format('select public.agent_token_make(%L, %L, %L, ''abcd'')', pg_temp.ws('vertuoza'), repeat('n', 41), repeat('b', 64)), '22023');
  perform pg_temp.refused(format('select public.agent_token_make(%L, ''ok'', ''not-a-hash'', ''abcd'')', pg_temp.ws('vertuoza')), '22023');
  perform pg_temp.refused(format('select public.agent_token_make(%L, ''ok'', %L, ''ab'')', pg_temp.ws('vertuoza'), repeat('b', 64)), '22023');
  -- Mo is no member of Acme.
  perform pg_temp.refused(format('select public.agent_token_make(%L, ''ok'', %L, ''abcd'')', pg_temp.ws('acme-links'), repeat('b', 64)), '42501');
end $$;
reset role;

-- ── Only the hash and the last four are stored ──
do $$
declare t public.agent_tokens;
begin
  select * into t from public.agent_tokens x where x.id = (pg_temp.kept('mo')).id;
  if t.token_hash <> pg_temp.hash((pg_temp.kept('mo')).token) or t.last_four <> '0001' then
    raise exception 'FAIL: the link is not stored as its hash and last four: %', t;
  end if;
  if position((pg_temp.kept('mo')).token in row(t.*)::text) > 0 then
    raise exception 'FAIL: the token itself is stored';
  end if;
end $$;

-- ── Anyone holding the token reads the business, as a member reads it ──
set local role anon;
select pg_temp.sign_out();
do $$
declare
  got jsonb;
  h text := pg_temp.hash((pg_temp.kept('mo')).token);
begin
  got := public.business_for_token(h, 'vertuoza/vertuo-apps');
  if got <> (pg_temp.kept('mo')).body then
    raise exception 'FAIL: business_for_token answered % where business_for_repo answered %', got, (pg_temp.kept('mo')).body;
  end if;
  if got::text like '%Rival Maybe%' then
    raise exception 'FAIL: a proposed claim left through the link';
  end if;
  -- One product: no repository reads it.
  got := public.business_for_token(h);
  if got <> (pg_temp.kept('mo')).body then
    raise exception 'FAIL: business_for_token without a repository answered %', got;
  end if;
  -- Another workspace's repository, or a malformed one, is refused.
  perform pg_temp.refused(format('select public.business_for_token(%L, ''acme-links/widgets'')', h), '42501');
  perform pg_temp.refused(format('select public.business_for_token(%L, ''not a repo'')', h), '22023');
  -- An unknown, a malformed and a missing token are refused.
  perform pg_temp.refused(format('select public.business_for_token(%L, ''vertuoza/vertuo-apps'')', pg_temp.hash('omb_nobody')), '28000');
  perform pg_temp.refused('select public.business_for_token(''omb_plain'', ''vertuoza/vertuo-apps'')', '28000');
  perform pg_temp.refused('select public.business_for_token(null, ''vertuoza/vertuo-apps'')', '28000');
end $$;
reset role;

-- ── `last used` moves at most once a minute ──
do $$
declare
  h text := pg_temp.hash((pg_temp.kept('mo')).token);
  before timestamptz;
  after timestamptz;
begin
  select last_used_at into before from public.agent_tokens where id = (pg_temp.kept('mo')).id;
  if before is null then raise exception 'FAIL: a read through the link left last used empty'; end if;
  update public.agent_tokens set last_used_at = now() - interval '30 seconds' where id = (pg_temp.kept('mo')).id;
  perform public.business_for_token(h);
  select last_used_at into after from public.agent_tokens where id = (pg_temp.kept('mo')).id;
  if after <> now() - interval '30 seconds' then raise exception 'FAIL: last used moved within the minute'; end if;
  update public.agent_tokens set last_used_at = now() - interval '2 minutes' where id = (pg_temp.kept('mo')).id;
  perform public.business_for_token(h);
  select last_used_at into after from public.agent_tokens where id = (pg_temp.kept('mo')).id;
  if after <> now() then raise exception 'FAIL: last used did not move after a minute'; end if;
end $$;

-- ── Several products: no repository names the tracked ones ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000085b1');
select public.product_add(pg_temp.ws('vertuoza'), 'Second product');
-- With two products, the read names the repository's product.
update kept set body = public.business_for_repo('vertuoza/vertuo-apps') where name = 'mo';
reset role;
set local role anon;
select pg_temp.sign_out();
do $$
declare
  h text := pg_temp.hash((pg_temp.kept('mo')).token);
  got jsonb;
begin
  -- Several products and no repository: the business with no product (PRD 1364), never a refusal.
  got := public.business_for_token(h);
  if got->'product' <> 'null'::jsonb or got->'personas' <> '[]'::jsonb or got->'business' = 'null'::jsonb
     or exists (select 1 from jsonb_array_elements(got->'claims') c where c->>'kind' <> 'region') then
    raise exception 'FAIL: several products and no repository did not answer the business with no product: %', got;
  end if;
  if (pg_temp.kept('mo')).body->'product' = 'null'::jsonb
     or public.business_for_token(h, 'vertuoza/vertuo-apps') <> (pg_temp.kept('mo')).body then
    raise exception 'FAIL: naming the repository no longer reads its product';
  end if;
end $$;
reset role;

-- ── The list: every member sees it, never the hash; Revoke for the maker and the owner ──
set local role authenticated;
do $$
declare listed jsonb;
begin
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000085b2');
  listed := public.agent_tokens_list(pg_temp.ws('vertuoza'));
  if jsonb_array_length(listed) <> 1 or listed->0->>'name' <> 'Mo''s editor' or (listed->0->>'mine')::boolean
     or (listed->0->>'canRevoke')::boolean or (listed->0->>'working')::boolean is not true
     or (listed->0->'maker'->>'id')::uuid <> '00000000-0000-4000-8000-0000000085b1' then
    raise exception 'FAIL: Nia read the list as %', listed;
  end if;
  if listed::text like '%' || pg_temp.hash((pg_temp.kept('mo')).token) || '%' then
    raise exception 'FAIL: the list carries the hash';
  end if;
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000085a1');
  listed := public.agent_tokens_list(pg_temp.ws('vertuoza'));
  if (listed->0->>'canRevoke')::boolean is not true or (listed->0->>'mine')::boolean then
    raise exception 'FAIL: the owner may not revoke Mo''s link: %', listed;
  end if;
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000085c1');
  perform pg_temp.refused(format('select public.agent_tokens_list(%L)', pg_temp.ws('vertuoza')), '42501');
end $$;
reset role;

-- ── Only the maker or an owner revokes, and a revoked link stops at once ──
set local role authenticated;
do $$
declare
  second text := 'omb_MoSecondTokenBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB0002';
  third text := 'omb_MoThirdTokenCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC0003';
  made jsonb;
begin
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000085b1');
  made := public.agent_token_make(pg_temp.ws('vertuoza'), 'Laptop', pg_temp.hash(second), right(second, 4));
  insert into kept values ('second', second, (made->>'id')::uuid, null);
  made := public.agent_token_make(pg_temp.ws('vertuoza'), 'Desktop', pg_temp.hash(third), right(third, 4));
  insert into kept values ('third', third, (made->>'id')::uuid, null);

  -- Nia, a member, and Carl, another workspace's owner, may not.
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000085b2');
  perform pg_temp.refused(format('select public.agent_token_revoke(%L, %L)', pg_temp.ws('vertuoza'), (pg_temp.kept('mo')).id), '42501');
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000085c1');
  perform pg_temp.refused(format('select public.agent_token_revoke(%L, %L)', pg_temp.ws('vertuoza'), (pg_temp.kept('mo')).id), '42501');
  perform pg_temp.refused(format('select public.agent_token_revoke(%L, %L)', pg_temp.ws('acme-links'), (pg_temp.kept('mo')).id), 'P0002');

  -- Mo revokes his own; Olga, the owner, revokes another of Mo's.
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000085b1');
  made := public.agent_token_revoke(pg_temp.ws('vertuoza'), (pg_temp.kept('mo')).id);
  if made->>'id' <> (pg_temp.kept('mo')).id::text then raise exception 'FAIL: revoking answered %', made; end if;
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000085a1');
  perform public.agent_token_revoke(pg_temp.ws('vertuoza'), (pg_temp.kept('second')).id);
  if jsonb_array_length(public.agent_tokens_list(pg_temp.ws('vertuoza'))) <> 1 then
    raise exception 'FAIL: the list still shows a revoked link';
  end if;
end $$;
reset role;
do $$
begin
  if (select count(*) from public.agent_tokens where revoked_at is not null) <> 2 then
    raise exception 'FAIL: a revoked link was not kept';
  end if;
end $$;
set local role anon;
select pg_temp.sign_out();
do $$
begin
  perform pg_temp.refused(format('select public.business_for_token(%L)', pg_temp.hash((pg_temp.kept('mo')).token)), '28000');
  perform pg_temp.refused(format('select public.business_for_token(%L)', pg_temp.hash((pg_temp.kept('second')).token)), '28000');
  perform public.business_for_token(pg_temp.hash((pg_temp.kept('third')).token), 'vertuoza/vertuo-apps');
end $$;
reset role;

-- ── A revoked name may be used again; the 21st live link is refused ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000085b1');
do $$
declare i integer;
begin
  perform public.agent_token_make(pg_temp.ws('vertuoza'), 'Mo''s editor', pg_temp.hash('omb_again'), 'gain');
  -- Mo holds 2 live links (Desktop and Mo's editor): 18 more make 20.
  for i in 1..18 loop
    perform public.agent_token_make(pg_temp.ws('vertuoza'), 'Link ' || i, pg_temp.hash('omb_many_' || i), lpad(i::text, 4, '0'));
  end loop;
  perform pg_temp.refused(format('select public.agent_token_make(%L, ''One too many'', %L, ''abcd'')', pg_temp.ws('vertuoza'), pg_temp.hash('omb_21')), '54000');
end $$;
reset role;

-- ── A link whose maker left the workspace stops, and is listed as not working ──
delete from public.workspace_members
 where workspace_id = pg_temp.ws('vertuoza') and user_id = '00000000-0000-4000-8000-0000000085b1';
set local role anon;
select pg_temp.sign_out();
select pg_temp.refused(format('select public.business_for_token(%L)', pg_temp.hash((pg_temp.kept('third')).token)), '28000');
reset role;
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000085a1');
do $$
declare listed jsonb := public.agent_tokens_list(pg_temp.ws('vertuoza'));
begin
  if jsonb_array_length(listed) <> 20 or exists (select 1 from jsonb_array_elements(listed) e where (e->>'working')::boolean) then
    raise exception 'FAIL: the links of a person who left are not listed as not working: %', listed;
  end if;
  -- The owner revokes one left behind.
  perform public.agent_token_revoke(pg_temp.ws('vertuoza'), (pg_temp.kept('third')).id);
end $$;
reset role;

-- ══ Kit tokens (PRD 1628) ══════════════════════════════════════════════════════════
-- Kai is a member of Vertuoza; Olga owns it and Nia is a member (above).
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000085d1', 'kai@vertuoza.com', now());
insert into auth.identities (user_id, provider, provider_id, identity_data) values
  ('00000000-0000-4000-8000-0000000085d1', 'github', '162801', '{"user_name": "kai-gh"}');
insert into public.workspace_members (workspace_id, user_id, role)
values (pg_temp.ws('vertuoza'), '00000000-0000-4000-8000-0000000085d1', 'member');

-- ── Signed out, nothing is made, listed or claimed; signed in, nobody claims, renews or reads a session ──
set local role anon;
select pg_temp.sign_out();
do $$
declare c text;
begin
  foreach c in array array[
    format('select public.kit_token_make(null, ''x'', %L, ''abcd'', 90, ''sealed'')', repeat('a', 64)),
    format('select public.kit_tokens_mine(%L)', pg_temp.ws('vertuoza')),
    format('select public.kit_token_claim(%L)', repeat('a', 64)),
    'select public.kit_token_renewed(gen_random_uuid(), gen_random_uuid(), ''sealed'')',
    'select public.kit_token_release(gen_random_uuid(), gen_random_uuid())',
    'select session from public.agent_tokens'
  ] loop perform pg_temp.refused(c, '42501'); end loop;
end $$;
reset role;
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000085d1');
do $$
declare c text;
begin
  foreach c in array array[
    format('select public.kit_token_claim(%L)', repeat('a', 64)),
    'select public.kit_token_renewed(gen_random_uuid(), gen_random_uuid(), ''sealed'')',
    'select public.kit_token_release(gen_random_uuid(), gen_random_uuid())',
    'select public.agent_tokens_live(''00000000-0000-4000-8000-0000000085d1'')',
    'select session from public.agent_tokens',
    'update public.agent_tokens set session = null'
  ] loop perform pg_temp.refused(c, '42501'); end loop;
end $$;
reset role;

-- ── Kai's round trip makes a kit token: hash, last four and sealed session stored, never listed ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000085d1');
do $$
declare
  tok text := 'omk_KaiLaptopTokenAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAk001';
  made jsonb;
begin
  -- No workspace named: Kai's first one, Vertuoza.
  made := public.kit_token_make(null, ' terminal 2026-12-04 ', pg_temp.hash(tok), right(tok, 4), 90, 'sealed-kai-1');
  if made->>'scope' <> 'kit' or made->>'name' <> 'terminal 2026-12-04' or made->>'lastFour' <> 'k001'
     or (made->>'expiresAt')::timestamptz <> now() + interval '90 days' or (made->>'mine')::boolean is not true
     or made ? 'session' or made ? 'hash' or made ? 'tokenHash' or made::text like '%sealed-kai%' then
    raise exception 'FAIL: a made kit token answered %', made;
  end if;
  insert into kept values ('kai-a', tok, (made->>'id')::uuid, null);

  -- The same name again is fine for a kit token; the workspace may be named by its slug.
  tok := 'omk_KaiSecondTokenBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBk002';
  made := public.kit_token_make('vertuoza', 'terminal 2026-12-04', pg_temp.hash(tok), right(tok, 4), 30, 'sealed-kai-2');
  if (made->>'expiresAt')::timestamptz <> now() + interval '30 days' then raise exception 'FAIL: 30 days answered %', made; end if;
  insert into kept values ('kai-b', tok, (made->>'id')::uuid, null);
  tok := 'omk_KaiThirdTokenCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCk003';
  -- An empty slug is no slug: the first workspace again.
  made := public.kit_token_make('', 'cloud', pg_temp.hash(tok), right(tok, 4), 365, 'sealed-kai-3');
  if (made->>'expiresAt')::timestamptz <> now() + interval '365 days' then raise exception 'FAIL: 365 days answered %', made; end if;
  insert into kept values ('kai-c', tok, (made->>'id')::uuid, null);

  -- Only 30, 90 or 365 days, a name, a hash, a last four and a session; only a workspace Kai is in.
  perform pg_temp.refused(format('select public.kit_token_make(null, ''x'', %L, ''abcd'', 7, ''s'')', repeat('b', 64)), '22023');
  perform pg_temp.refused(format('select public.kit_token_make(null, ''x'', %L, ''abcd'', null, ''s'')', repeat('b', 64)), '22023');
  perform pg_temp.refused(format('select public.kit_token_make(null, ''x'', %L, ''abcd'', 90, '''')', repeat('b', 64)), '22023');
  perform pg_temp.refused(format('select public.kit_token_make(null, ''x'', %L, ''abcd'', 90, null)', repeat('b', 64)), '22023');
  perform pg_temp.refused(format('select public.kit_token_make(null, '''', %L, ''abcd'', 90, ''s'')', repeat('b', 64)), '22023');
  perform pg_temp.refused('select public.kit_token_make(null, ''x'', ''not-a-hash'', ''abcd'', 90, ''s'')', '22023');
  perform pg_temp.refused(format('select public.kit_token_make(null, ''x'', %L, ''ab'', 90, ''s'')', repeat('b', 64)), '22023');
  perform pg_temp.refused(format('select public.kit_token_make(''acme-links'', ''x'', %L, ''abcd'', 90, ''s'')', repeat('b', 64)), '42501');
  perform pg_temp.refused(format('select public.kit_token_make(''no-such-place'', ''x'', %L, ''abcd'', 90, ''s'')', repeat('b', 64)), '42501');
end $$;
reset role;
-- One transaction, one now(): Kai made them a minute apart.
update public.agent_tokens set created_at = now() - interval '3 minutes' where id = (pg_temp.kept('kai-a')).id;
update public.agent_tokens set created_at = now() - interval '2 minutes' where id = (pg_temp.kept('kai-b')).id;
update public.agent_tokens set created_at = now() - interval '1 minute' where id = (pg_temp.kept('kai-c')).id;
do $$
declare t public.agent_tokens;
begin
  select * into t from public.agent_tokens x where x.id = (pg_temp.kept('kai-a')).id;
  if t.scope <> 'kit' or t.token_hash <> pg_temp.hash((pg_temp.kept('kai-a')).token) or t.last_four <> 'k001'
     or t.session <> 'sealed-kai-1' or t.workspace_id <> pg_temp.ws('vertuoza') then
    raise exception 'FAIL: the kit token is not stored as its hash, last four and sealed session: %', t;
  end if;
  if position((pg_temp.kept('kai-a')).token in row(t.*)::text) > 0 then
    raise exception 'FAIL: the kit token itself is stored';
  end if;
  -- A kit token always has an expiry; a business link has none, and no session.
  perform pg_temp.refused(format('update public.agent_tokens set expires_at = null where id = %L', t.id), '23514');
  perform pg_temp.refused(format('update public.agent_tokens set session = ''x'' where id = %L', (pg_temp.kept('third')).id), '23514');
  perform pg_temp.refused(format('update public.agent_tokens set expires_at = now() where id = %L', (pg_temp.kept('third')).id), '23514');
end $$;

-- ── A kit token never reads through business_for_token() ──
set local role anon;
select pg_temp.sign_out();
select pg_temp.refused(format('select public.business_for_token(%L)', pg_temp.hash((pg_temp.kept('kai-a')).token)), '28000');
select pg_temp.refused(format('select public.business_for_token(%L, ''vertuoza/vertuo-apps'')', pg_temp.hash((pg_temp.kept('kai-a')).token)), '28000');
reset role;

-- ── The lists: Kai sees his own kit tokens; Nia does not; Olga, the owner, does ──
set local role authenticated;
do $$
declare
  mine jsonb;
  listed jsonb;
begin
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000085d1');
  mine := public.kit_tokens_mine(pg_temp.ws('vertuoza'));
  if jsonb_array_length(mine->'tokens') <> 3 or (mine->>'live')::integer <> 3 or (mine->>'limit')::integer <> 20
     or mine->'tokens'->0->>'lastFour' <> 'k003' or mine->'tokens'->2->>'lastFour' <> 'k001'
     or mine::text like '%sealed-kai%' then
    raise exception 'FAIL: Kai''s own kit tokens read %', mine;
  end if;
  listed := public.agent_tokens_list(pg_temp.ws('vertuoza'));
  if (select count(*) from jsonb_array_elements(listed) e where e->>'scope' = 'kit') <> 3 then
    raise exception 'FAIL: Kai''s list lacks his kit tokens: %', listed;
  end if;
  perform pg_temp.refused(format('select public.kit_tokens_mine(%L)', pg_temp.ws('acme-links')), '42501');

  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000085b2');
  if jsonb_array_length(public.kit_tokens_mine(pg_temp.ws('vertuoza'))->'tokens') <> 0
     or exists (select 1 from jsonb_array_elements(public.agent_tokens_list(pg_temp.ws('vertuoza'))) e where e->>'scope' = 'kit') then
    raise exception 'FAIL: Nia sees Kai''s kit tokens';
  end if;

  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000085a1');
  listed := public.agent_tokens_list(pg_temp.ws('vertuoza'));
  if (select count(*) from jsonb_array_elements(listed) e where e->>'scope' = 'kit' and (e->>'canRevoke')::boolean) <> 3
     or listed::text like '%sealed-kai%' then
    raise exception 'FAIL: the owner does not see Kai''s kit tokens to revoke: %', listed;
  end if;
end $$;
reset role;

-- ── The exchange, as the service role: claim under a lease, renew, release ──
set local role service_role;
do $$
declare
  h text := pg_temp.hash((pg_temp.kept('kai-a')).token);
  got jsonb;
  again jsonb;
  lease uuid;
begin
  got := public.kit_token_claim(h);
  if got->>'state' <> 'ok' or got->>'session' <> 'sealed-kai-1' or (got->>'id')::uuid <> (pg_temp.kept('kai-a')).id
     or (got->>'owner')::uuid <> '00000000-0000-4000-8000-0000000085d1' or got->>'lastFour' <> 'k001' or got->>'lease' is null
     or (got->>'expiresAt')::timestamptz <> now() + interval '90 days' then
    raise exception 'FAIL: claiming a kit token answered %', got;
  end if;
  lease := (got->>'lease')::uuid;
  -- A second exchange waits for the first.
  again := public.kit_token_claim(h);
  if again <> '{"state": "busy"}'::jsonb then raise exception 'FAIL: a claim under lease answered %', again; end if;
  -- Only the lease's holder writes the renewed session back, once.
  if public.kit_token_renewed((got->>'id')::uuid, gen_random_uuid(), 'sealed-kai-stolen') then
    raise exception 'FAIL: another lease renewed the session';
  end if;
  if not public.kit_token_renewed((got->>'id')::uuid, lease, 'sealed-kai-1b') then
    raise exception 'FAIL: the lease''s holder could not renew the session';
  end if;
  if public.kit_token_renewed((got->>'id')::uuid, lease, 'sealed-kai-again') then
    raise exception 'FAIL: an ended lease renewed the session twice';
  end if;
  -- Free again: the next claim reads the renewed session; a failed exchange releases its lease.
  got := public.kit_token_claim(h);
  if got->>'state' <> 'ok' or got->>'session' <> 'sealed-kai-1b' then raise exception 'FAIL: the renewed session reads %', got; end if;
  perform public.kit_token_release((got->>'id')::uuid, (got->>'lease')::uuid);
  got := public.kit_token_claim(h);
  if got->>'state' <> 'ok' then raise exception 'FAIL: a released lease still holds: %', got; end if;
  -- This exchange never comes back.
  -- A business link, an unknown token, a malformed hash and none are unknown to the exchange.
  foreach h in array array[pg_temp.hash((pg_temp.kept('third')).token), pg_temp.hash('omk_nobody'), 'not-a-hash'] loop
    got := public.kit_token_claim(h);
    if got <> '{"state": "unknown"}'::jsonb then raise exception 'FAIL: claiming % answered %', h, got; end if;
  end loop;
  got := public.kit_token_claim(null);
  if got <> '{"state": "unknown"}'::jsonb then raise exception 'FAIL: claiming null answered %', got; end if;
end $$;
reset role;
-- An exchange that never came back holds the lease 30 seconds at most.
update public.agent_tokens set session_lease_until = now() - interval '1 second' where id = (pg_temp.kept('kai-a')).id;
set local role service_role;
do $$
declare got jsonb := public.kit_token_claim(pg_temp.hash((pg_temp.kept('kai-a')).token));
begin
  if got->>'state' <> 'ok' then raise exception 'FAIL: an abandoned lease still holds: %', got; end if;
  perform public.kit_token_release((got->>'id')::uuid, (got->>'lease')::uuid);
end $$;
reset role;
do $$
declare t public.agent_tokens;
begin
  select * into t from public.agent_tokens x where x.id = (pg_temp.kept('kai-a')).id;
  if t.session <> 'sealed-kai-1b' or t.session_lease is not null or t.last_used_at is null then
    raise exception 'FAIL: the renewed session was not written back, or last used not set: %', t;
  end if;
end $$;

-- ── Past its expiry, a kit token is refused with the date, and is not live ──
update public.agent_tokens set expires_at = now() - interval '1 second', created_at = now() - interval '31 days'
 where id = (pg_temp.kept('kai-b')).id;
set local role service_role;
do $$
declare got jsonb := public.kit_token_claim(pg_temp.hash((pg_temp.kept('kai-b')).token));
begin
  if got->>'state' <> 'expired' or (got->>'expiresAt')::timestamptz <> now() - interval '1 second' or got ? 'session' then
    raise exception 'FAIL: an expired kit token answered %', got;
  end if;
end $$;
reset role;
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000085d1');
do $$
declare mine jsonb := public.kit_tokens_mine(pg_temp.ws('vertuoza'));
begin
  if jsonb_array_length(mine->'tokens') <> 2 or (mine->>'live')::integer <> 2 then
    raise exception 'FAIL: an expired kit token is still listed or live: %', mine;
  end if;
end $$;
reset role;

-- ── 20 live tokens, both scopes together ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000085d1');
do $$
declare
  i integer;
  links uuid[] := '{}';
begin
  -- Kai holds 2 live kit tokens (the expired one does not count): 18 business links make 20.
  for i in 1..18 loop
    links := links || (public.agent_token_make(pg_temp.ws('vertuoza'), 'Kai link ' || i, pg_temp.hash('omb_kai_' || i), lpad(i::text, 4, '0'))->>'id')::uuid;
  end loop;
  perform pg_temp.refused(format('select public.kit_token_make(null, ''one more'', %L, ''abcd'', 90, ''s'')', pg_temp.hash('omk_kai_21')), '54000');
  perform pg_temp.refused(format('select public.agent_token_make(%L, ''one more'', %L, ''abcd'')', pg_temp.ws('vertuoza'), pg_temp.hash('omb_kai_21')), '54000');
  if (public.kit_tokens_mine(pg_temp.ws('vertuoza'))->>'live')::integer <> 20 then
    raise exception 'FAIL: Kai''s live count is not 20';
  end if;
  -- A business link's name is still unique among business links, whatever the kit tokens are named.
  perform public.agent_token_revoke(pg_temp.ws('vertuoza'), links[18]);
  perform public.agent_token_make(pg_temp.ws('vertuoza'), 'cloud', pg_temp.hash('omb_kai_cloud'), 'clou');
  perform public.agent_token_revoke(pg_temp.ws('vertuoza'), links[17]);
  perform pg_temp.refused(format('select public.agent_token_make(%L, ''Cloud'', %L, ''abcd'')', pg_temp.ws('vertuoza'), pg_temp.hash('omb_kai_cloud2')), '22023');
end $$;
reset role;

-- ── Revoking a kit token, by its maker or by an owner, clears its session; then it is refused ──
set local role authenticated;
do $$
declare made jsonb;
begin
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000085d1');
  made := public.agent_token_revoke(pg_temp.ws('vertuoza'), (pg_temp.kept('kai-a')).id);
  if made->>'scope' <> 'kit' or made ? 'session' then raise exception 'FAIL: revoking a kit token answered %', made; end if;
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000085b2');
  perform pg_temp.refused(format('select public.agent_token_revoke(%L, %L)', pg_temp.ws('vertuoza'), (pg_temp.kept('kai-c')).id), '42501');
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000085a1');
  perform public.agent_token_revoke(pg_temp.ws('vertuoza'), (pg_temp.kept('kai-c')).id);
end $$;
reset role;
do $$
begin
  if exists (select 1 from public.agent_tokens x
              where x.id in ((pg_temp.kept('kai-a')).id, (pg_temp.kept('kai-c')).id)
                and (x.revoked_at is null or x.session is not null or x.session_lease is not null)) then
    raise exception 'FAIL: a revoked kit token kept its session';
  end if;
end $$;
set local role service_role;
do $$
declare got jsonb;
begin
  got := public.kit_token_claim(pg_temp.hash((pg_temp.kept('kai-a')).token));
  if got <> '{"state": "revoked"}'::jsonb then raise exception 'FAIL: a token its maker revoked answered %', got; end if;
  got := public.kit_token_claim(pg_temp.hash((pg_temp.kept('kai-c')).token));
  if got <> '{"state": "revoked"}'::jsonb then raise exception 'FAIL: a token the owner revoked answered %', got; end if;
end $$;
reset role;

-- ── A kit token whose maker left the workspace is refused, naming who and where ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000085d1');
do $$
declare made jsonb;
begin
  made := public.kit_token_make(null, 'leaving', pg_temp.hash('omk_KaiLeavingTokenDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDk004'), 'k004', 90, 'sealed-kai-4');
  insert into kept values ('kai-d', 'omk_KaiLeavingTokenDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDk004', (made->>'id')::uuid, null);
end $$;
reset role;
delete from public.workspace_members
 where workspace_id = pg_temp.ws('vertuoza') and user_id = '00000000-0000-4000-8000-0000000085d1';
set local role service_role;
do $$
declare got jsonb := public.kit_token_claim(pg_temp.hash((pg_temp.kept('kai-d')).token));
begin
  if got->>'state' <> 'not-a-member' or got->>'login' <> 'kai-gh' or got->'workspace'->>'name' <> 'Vertuoza'
     or got->'workspace'->>'slug' <> 'vertuoza' or got ? 'session' then
    raise exception 'FAIL: an ex-member''s kit token answered %', got;
  end if;
end $$;
reset role;
-- Kai, in no workspace now, cannot make another.
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000085d1');
select pg_temp.refused(format('select public.kit_token_make(null, ''x'', %L, ''abcd'', 90, ''s'')', pg_temp.hash('omk_kai_none')), '42501');
reset role;

rollback;
