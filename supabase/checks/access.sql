-- Who may read and write the galaxy. The supabase workflow runs it on every pull request, after
-- `supabase db start` has applied the migrations and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/access.sql
-- One transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000000a', 'ada@vertuoza.com'),
  ('00000000-0000-4000-8000-00000000000b', 'bob@vertuoza.com'),
  ('00000000-0000-4000-8000-00000000000c', 'carol@vertuoza.com'),
  ('00000000-0000-4000-8000-00000000000e', 'eve@example.com');
-- Ada and Bob linked GitHub (players); Carol did not (a visitor).
insert into auth.identities (user_id, provider, provider_id, identity_data) values
  ('00000000-0000-4000-8000-00000000000a', 'github', '424242', '{"user_name": "ada-gh"}'),
  ('00000000-0000-4000-8000-00000000000b', 'github', '1001', '{"user_name": "bob-gh"}');

-- Act as a signed-in user for the rest of the transaction.
create function pg_temp.sign_in(uid text, email text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'email', email, 'role', 'authenticated')::text, true);
$$;

-- ── Signed out: the fleets, nothing else ──
set local role anon;
do $$
begin
  if (select count(*) from public.teams where retired_at is null) < 5 then raise exception 'FAIL: anon cannot read the fleets'; end if;
  begin perform 1 from public.ledger_events limit 1; raise exception 'FAIL: anon read the ledger';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.sectors limit 1; raise exception 'FAIL: anon read the sectors';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.players limit 1; raise exception 'FAIL: anon read the players';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Signed in with another domain: nothing ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-00000000000e', 'eve@example.com');
do $$
begin
  if (select count(*) from public.ledger_events) <> 0 then raise exception 'FAIL: an outsider read the ledger'; end if;
  if (select count(*) from public.sectors) <> 0 then raise exception 'FAIL: an outsider read the sectors'; end if;
  begin
    insert into public.players (id, display_name, team, hero)
    values ('00000000-0000-4000-8000-00000000000e', 'EVE', 'beaver', '{"v":1,"body":"girl","skin":0,"hair":0,"suit":0,"cape":0}');
    raise exception 'FAIL: an outsider joined a fleet';
  exception when insufficient_privilege then null; end;
end $$;

-- ── The crew ──
select pg_temp.sign_in('00000000-0000-4000-8000-00000000000a', 'ada@vertuoza.com');
do $$
declare
  n int;
  hero constant jsonb := '{"v":1,"body":"girl","skin":2,"hair":3,"suit":0,"cape":8}';
begin
  if (select count(*) from public.ledger_events) = 0 then raise exception 'FAIL: the crew cannot read the ledger'; end if;
  if (select count(*) from public.sectors) = 0 then raise exception 'FAIL: the crew cannot read the sectors'; end if;

  insert into public.players (id, display_name, team, hero) values ('00000000-0000-4000-8000-00000000000a', 'ADA', 'pirates', hero);
  if (select team_since from public.players where id = '00000000-0000-4000-8000-00000000000a') is null then
    raise exception 'FAIL: joining a fleet did not stamp team_since';
  end if;
  if (select github_login from public.players where id = '00000000-0000-4000-8000-00000000000a') is distinct from 'ada-gh'
     or (select github_id from public.players where id = '00000000-0000-4000-8000-00000000000a') is distinct from 424242 then
    raise exception 'FAIL: a new player did not start with their linked GitHub account';
  end if;
  update public.players set team = 'beaver', display_name = 'ADA-L' where id = '00000000-0000-4000-8000-00000000000a';
  if (select team from public.players where id = '00000000-0000-4000-8000-00000000000a') <> 'beaver' then
    raise exception 'FAIL: a player could not change fleet';
  end if;

  begin
    update public.players set github_login = 'someone-else' where id = '00000000-0000-4000-8000-00000000000a';
    raise exception 'FAIL: a player typed their own GitHub login';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.players (id, display_name, team, hero, github_login)
    values ('00000000-0000-4000-8000-00000000000b', 'BOB', 'beaver', hero, 'bob-gh');
    raise exception 'FAIL: a player inserted a GitHub login';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.players (id, display_name, team, hero) values ('00000000-0000-4000-8000-00000000000b', 'BOB', 'beaver', hero);
    raise exception 'FAIL: a player created someone else';
  exception when insufficient_privilege then null; end;
  begin
    update public.players set team = 'invincible-team' where id = '00000000-0000-4000-8000-00000000000a';
    raise exception 'FAIL: a player joined a retired fleet';
  exception when check_violation then null; end;
  begin
    update public.players set hero = '{"v":1,"body":"cat","skin":0,"hair":0,"suit":0,"cape":0}' where id = '00000000-0000-4000-8000-00000000000a';
    raise exception 'FAIL: a malformed hero was saved';
  exception when check_violation then null; end;
  begin
    update public.players set hero = '{"v":1,"body":"boy","skin":6,"hair":0,"suit":0,"cape":0}' where id = '00000000-0000-4000-8000-00000000000a';
    raise exception 'FAIL: a hero outside the presets was saved';
  exception when check_violation then null; end;
  begin
    update public.players set display_name = 'too long name' where id = '00000000-0000-4000-8000-00000000000a';
    raise exception 'FAIL: a name outside A-Z 0-9 - was saved';
  exception when check_violation then null; end;

  if public.link_github() ->> 'github_login' is distinct from 'ada-gh' then
    raise exception 'FAIL: link_github did not answer the linked GitHub account';
  end if;
end $$;

select pg_temp.sign_in('00000000-0000-4000-8000-00000000000b', 'bob@vertuoza.com');
do $$
declare n int;
begin
  insert into public.players (id, display_name, team, hero)
  values ('00000000-0000-4000-8000-00000000000b', 'BOB', 'octopod', '{"v":1,"body":"boy","skin":0,"hair":0,"suit":1,"cape":0}');
  if (select count(*) from public.players) <> 2 then raise exception 'FAIL: the crew cannot see each other'; end if;
  update public.players set team = 'cia' where id = '00000000-0000-4000-8000-00000000000a';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: a player changed someone else''s fleet'; end if;
end $$;

-- ── A visitor: signed in with Google, no GitHub linked. Looks, does not play ──
select pg_temp.sign_in('00000000-0000-4000-8000-00000000000c', 'carol@vertuoza.com');
do $$
begin
  if (select count(*) from public.ledger_events) = 0 then raise exception 'FAIL: a visitor cannot look at the galaxy'; end if;
  begin
    insert into public.players (id, display_name, team, hero)
    values ('00000000-0000-4000-8000-00000000000c', 'CAROL', 'beaver', '{"v":1,"body":"girl","skin":0,"hair":0,"suit":0,"cape":0}');
    raise exception 'FAIL: a visitor joined a fleet without linking GitHub';
  exception when insufficient_privilege then null; end;
  if exists (select 1 from public.my_github()) then raise exception 'FAIL: my_github answered for an unlinked visitor'; end if;
  begin
    perform public.link_github();
    raise exception 'FAIL: link_github linked a visitor with no GitHub identity';
  exception when no_data_found then null; end;
end $$;
reset role;

-- ── The game workflow (service role): reads the roster, appends to the ledger, never rewrites it ──
do $$
declare t text;
begin
  foreach t in array array['public.teams', 'public.sectors', 'public.players', 'public.ledger_events'] loop
    if not has_table_privilege('service_role', t, 'select') then raise exception 'FAIL: the workflow cannot read %', t; end if;
  end loop;
  if not has_table_privilege('service_role', 'public.ledger_events', 'insert') then raise exception 'FAIL: the workflow cannot append'; end if;
  if has_table_privilege('service_role', 'public.ledger_events', 'update') or has_table_privilege('service_role', 'public.ledger_events', 'delete') then
    raise exception 'FAIL: the workflow may rewrite the ledger';
  end if;
  insert into public.ledger_events (id, at, type, planet) values ('check:planet:1:charted', now(), 'PLANET_CHARTED', 1);
  begin
    update public.ledger_events set planet = 2 where id = 'check:planet:1:charted';
    raise exception 'FAIL: the ledger was rewritten';
  exception when raise_exception then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
end $$;

-- ── The sign-in hook ──
do $$
begin
  if public.hook_before_user_created('{"user": {"email": "Ada@Vertuoza.com"}}') <> '{}'::jsonb then
    raise exception 'FAIL: the hook refused a vertuoza.com account';
  end if;
  if public.hook_before_user_created('{"user": {"email": "eve@notvertuoza.com"}}') -> 'error' ->> 'http_code' <> '403' then
    raise exception 'FAIL: the hook let another domain in';
  end if;
  if has_function_privilege('authenticated', 'public.hook_before_user_created(jsonb)', 'execute')
     or not has_function_privilege('supabase_auth_admin', 'public.hook_before_user_created(jsonb)', 'execute') then
    raise exception 'FAIL: the hook is callable by the wrong roles';
  end if;
  if has_table_privilege('anon', 'public.teams', 'insert, update, delete, truncate')
     or has_table_privilege('authenticated', 'public.teams', 'insert, update, delete, truncate') then
    raise exception 'FAIL: a signed-in user may edit the fleets';
  end if;
end $$;

select 'access checks passed' as result;
rollback;
