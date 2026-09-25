-- Who may read and write the galaxy, workspace by workspace. The supabase workflow runs it on every
-- pull request, after `supabase db start` has applied the migrations and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/access.sql
-- One transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

-- ── Vertuoza is workspace #1, with today's six fleets ──
do $$
declare w public.workspaces;
begin
  if (select count(*) from public.workspaces) <> 1 then raise exception 'FAIL: the migrations left % workspaces, not one', (select count(*) from public.workspaces); end if;
  select * into w from public.workspaces where slug = 'vertuoza';
  if not found then raise exception 'FAIL: there is no vertuoza workspace'; end if;
  if (w.name, w.github_org, w.plan_repo, w.join_domain, w.theme)
     is distinct from ('Vertuoza'::text, 'vertuoza'::text, 'vertuo-omni-plan'::text, 'vertuoza.com'::text, '{}'::jsonb) then
    raise exception 'FAIL: the vertuoza workspace is not as the spec sets it: %', row_to_json(w);
  end if;
  if exists (
    with fleets as (select name, label, color, motto, mascot, sort::int, retired_at is not null as retired
                      from public.teams where workspace_id = w.id),
         today (name, label, color, motto, mascot, sort, retired) as (values
           ('beaver',          'BEAVER',     '#d08a4a', 'Builds the dam. Secures the zone.', 'beaver',     10, false),
           ('octopod',         'OCTOPOD',    '#b07cff', 'Eight arms, eight sub-PRs.',        'octopod',    20, false),
           ('picsou',          'PICSOU',     '#ffd84a', 'Every coin counted twice.',         'picsou',     30, false),
           ('cia',             'C.I.A.',     '#9aa3c8', 'Knows every open question.',        'cia',        40, false),
           ('pirates',         'PIRATES',    '#2fc6a4', 'Takes the zones nobody claims.',    'pirate',     50, false),
           ('invincible-team', 'INVINCIBLE', '#4fb0ff', 'Think, Mark. Then ship it.',        'invincible', 90, true))
    (select * from fleets except select * from today) union all (select * from today except select * from fleets)
  ) then
    raise exception 'FAIL: the vertuoza fleets are not today''s six (labels, colours, mottos, mascots, order, invincible-team retired)';
  end if;
  if not exists (select 1 from public.sectors where workspace_id = w.id)
     or not exists (select 1 from public.ledger_events where workspace_id = w.id) then
    raise exception 'FAIL: the demo seed did not fill the vertuoza workspace';
  end if;
end $$;

-- ── The cast ──
-- A second workspace, Acme, with its own sector, two fleets (one named like a Vertuoza fleet) and
-- one event whose id Vertuoza's ledger holds too.
insert into public.workspaces (id, slug, name, github_org, plan_repo, join_domain) values
  ('00000000-0000-4000-8000-0000000000a2', 'acme', 'Acme', 'acme', 'acme-plan', 'acme.test');
insert into public.sectors (workspace_id, name, repos) values
  ('00000000-0000-4000-8000-0000000000a2', 'dust-belt', array['acme-api']);
insert into public.teams (workspace_id, name, label, color, home, sort) values
  ('00000000-0000-4000-8000-0000000000a2', 'roadrunners', 'ROADRUNNERS', '#ffcc00', 'dust-belt', 10),
  ('00000000-0000-4000-8000-0000000000a2', 'beaver', 'BEAVER', '#8a5a2b', null, 20);
insert into public.ledger_events (workspace_id, id, at, type, planet)
select '00000000-0000-4000-8000-0000000000a2', e.id, now(), 'PLANET_CHARTED', 1
  from public.ledger_events e
 where e.workspace_id = (select id from public.workspaces where slug = 'vertuoza')
 order by e.id
 limit 1;

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-00000000000a', 'ada@vertuoza.com', now()),   -- a player
  ('00000000-0000-4000-8000-00000000000b', 'bob@vertuoza.com', now()),   -- a player
  ('00000000-0000-4000-8000-00000000000c', 'carol@vertuoza.com', now()), -- a visitor: no GitHub linked
  ('00000000-0000-4000-8000-00000000000d', 'dan@acme.test', now()),      -- Acme's player
  ('00000000-0000-4000-8000-00000000000e', 'eve@example.com', now()),    -- an outsider
  ('00000000-0000-4000-8000-00000000000f', 'fay@example.com', now()),    -- a freelancer, in both workspaces
  ('00000000-0000-4000-8000-000000000011', 'una@vertuoza.com', null);    -- never confirmed her address
insert into auth.identities (user_id, provider, provider_id, identity_data) values
  ('00000000-0000-4000-8000-00000000000a', 'github', '424242', '{"user_name": "ada-gh"}'),
  ('00000000-0000-4000-8000-00000000000b', 'github', '1001', '{"user_name": "bob-gh"}'),
  ('00000000-0000-4000-8000-00000000000d', 'github', '2002', '{"user_name": "dan-gh"}'),
  ('00000000-0000-4000-8000-00000000000f', 'github', '3003', '{"user_name": "fay-gh"}');
-- Fay's domain joins nothing: she is a member of both workspaces because someone added her.
insert into public.workspace_members (workspace_id, user_id)
select id, '00000000-0000-4000-8000-00000000000f' from public.workspaces;

-- Act as a signed-in user, or as nobody, for the rest of the transaction.
create function pg_temp.sign_in(uid text, email text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.sign_out() returns void language sql as $$
  select set_config('request.jwt.claims', '', true);
$$;

-- ── Signed out: nothing, the fleets included ──
set local role anon;
do $$
declare t text;
begin
  foreach t in array array['workspaces', 'workspace_members', 'sectors', 'teams', 'players', 'ledger_events'] loop
    begin
      execute format('select 1 from public.%I limit 1', t);
      raise exception 'FAIL: anon read public.%', t;
    exception when insufficient_privilege then null; end;
  end loop;
end $$;
reset role;

-- ── Joining by email domain, on a confirmed address only ──
set local role authenticated;
do $$
begin
  perform pg_temp.sign_in('00000000-0000-4000-8000-00000000000a', 'ada@vertuoza.com');
  if public.join_by_domain() is distinct from array['vertuoza'] then
    raise exception 'FAIL: a confirmed vertuoza.com account did not join vertuoza';
  end if;
  if public.join_by_domain() is distinct from array['vertuoza'] or (select count(*) from public.workspace_members) <> 1 then
    raise exception 'FAIL: a second join_by_domain() changed the memberships';
  end if;

  perform pg_temp.sign_in('00000000-0000-4000-8000-000000000011', 'una@vertuoza.com');
  if public.join_by_domain() <> '{}'::text[] or exists (select 1 from public.workspace_members) then
    raise exception 'FAIL: an unconfirmed vertuoza.com address joined a workspace';
  end if;

  perform pg_temp.sign_in('00000000-0000-4000-8000-00000000000e', 'eve@example.com');
  if public.join_by_domain() <> '{}'::text[] or exists (select 1 from public.workspace_members) then
    raise exception 'FAIL: an address of another domain joined a workspace';
  end if;

  perform pg_temp.sign_in('00000000-0000-4000-8000-00000000000f', 'fay@example.com');
  if public.join_by_domain() is distinct from array['acme', 'vertuoza'] then
    raise exception 'FAIL: join_by_domain() did not answer every workspace of the caller, first joined first';
  end if;

  perform pg_temp.sign_in('00000000-0000-4000-8000-00000000000b', 'bob@vertuoza.com');
  perform public.join_by_domain();
  perform pg_temp.sign_in('00000000-0000-4000-8000-00000000000c', 'carol@vertuoza.com');
  perform public.join_by_domain();
  perform pg_temp.sign_in('00000000-0000-4000-8000-00000000000d', 'dan@acme.test');
  if public.join_by_domain() is distinct from array['acme'] then
    raise exception 'FAIL: a confirmed acme.test account did not join acme';
  end if;
end $$;

-- ── Signed in, in no workspace: nothing ──
select pg_temp.sign_in('00000000-0000-4000-8000-00000000000e', 'eve@example.com');
do $$
declare t text; n int;
begin
  foreach t in array array['workspaces', 'workspace_members', 'sectors', 'teams', 'players', 'ledger_events'] loop
    execute format('select count(*) from public.%I', t) into n;
    if n <> 0 then raise exception 'FAIL: an outsider read % rows of public.%', n, t; end if;
  end loop;
  begin
    insert into public.players (workspace_id, user_id, display_name, team, hero)
    values ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-00000000000e', 'EVE', 'beaver', '{"v":1,"body":"girl","skin":0,"hair":0,"suit":0,"cape":0}');
    raise exception 'FAIL: an outsider joined a fleet';
  exception when insufficient_privilege then null; end;
  begin
    perform public.link_github();
    raise exception 'FAIL: link_github answered an outsider';
  exception when insufficient_privilege then null; end;
end $$;

-- ── The crew of Vertuoza ──
select pg_temp.sign_in('00000000-0000-4000-8000-00000000000a', 'ada@vertuoza.com');
do $$
declare
  v constant uuid := (select id from public.workspaces where slug = 'vertuoza');
  ada constant uuid := '00000000-0000-4000-8000-00000000000a';
  hero constant jsonb := '{"v":1,"body":"girl","skin":2,"hair":3,"suit":0,"cape":8}';
begin
  if v is null then raise exception 'FAIL: a member cannot read their workspace'; end if;
  if not exists (select 1 from public.ledger_events) then raise exception 'FAIL: the crew cannot read the ledger'; end if;
  if not exists (select 1 from public.sectors) then raise exception 'FAIL: the crew cannot read the sectors'; end if;
  if (select count(*) from public.teams where retired_at is null) <> 5 then raise exception 'FAIL: the crew cannot read the fleets'; end if;

  insert into public.players (workspace_id, user_id, display_name, team, hero) values (v, ada, 'ADA', 'pirates', hero);
  if (select team_since from public.players where user_id = ada) is null then
    raise exception 'FAIL: joining a fleet did not stamp team_since';
  end if;
  if (select github_login from public.players where user_id = ada) is distinct from 'ada-gh'
     or (select github_id from public.players where user_id = ada) is distinct from 424242 then
    raise exception 'FAIL: a new player did not start with their linked GitHub account';
  end if;
  update public.players set team = 'beaver', display_name = 'ADA-L' where user_id = ada;
  if (select team from public.players where user_id = ada) <> 'beaver' then
    raise exception 'FAIL: a player could not change fleet';
  end if;

  begin
    update public.players set github_login = 'someone-else' where user_id = ada;
    raise exception 'FAIL: a player typed their own GitHub login';
  exception when insufficient_privilege then null; end;
  begin
    update public.players set workspace_id = '00000000-0000-4000-8000-0000000000a2' where user_id = ada;
    raise exception 'FAIL: a player moved their row to another workspace';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.players (workspace_id, user_id, display_name, team, hero, github_login)
    values (v, '00000000-0000-4000-8000-00000000000b', 'BOB', 'beaver', hero, 'bob-gh');
    raise exception 'FAIL: a player inserted a GitHub login';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.players (workspace_id, user_id, display_name, team, hero) values (v, '00000000-0000-4000-8000-00000000000b', 'BOB', 'beaver', hero);
    raise exception 'FAIL: a player created someone else';
  exception when insufficient_privilege then null; end;
  begin
    update public.players set team = 'invincible-team' where user_id = ada;
    raise exception 'FAIL: a player joined a retired fleet';
  exception when check_violation then null; end;
  begin
    update public.players set hero = '{"v":1,"body":"cat","skin":0,"hair":0,"suit":0,"cape":0}' where user_id = ada;
    raise exception 'FAIL: a malformed hero was saved';
  exception when check_violation then null; end;
  begin
    update public.players set hero = '{"v":1,"body":"boy","skin":6,"hair":0,"suit":0,"cape":0}' where user_id = ada;
    raise exception 'FAIL: a hero outside the presets was saved';
  exception when check_violation then null; end;
  begin
    update public.players set display_name = 'too long name' where user_id = ada;
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
  insert into public.players (workspace_id, user_id, display_name, team, hero)
  values ((select id from public.workspaces where slug = 'vertuoza'), '00000000-0000-4000-8000-00000000000b', 'BOB', 'octopod',
          '{"v":1,"body":"boy","skin":0,"hair":0,"suit":1,"cape":0}');
  if (select count(*) from public.players) <> 2 then raise exception 'FAIL: the crew cannot see each other'; end if;
  update public.players set team = 'cia' where user_id = '00000000-0000-4000-8000-00000000000a';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: a player changed someone else''s fleet'; end if;
end $$;

-- ── A visitor: signed in with Google, no GitHub linked. Looks, does not play ──
select pg_temp.sign_in('00000000-0000-4000-8000-00000000000c', 'carol@vertuoza.com');
do $$
begin
  if not exists (select 1 from public.ledger_events) then raise exception 'FAIL: a visitor cannot look at the galaxy'; end if;
  begin
    insert into public.players (workspace_id, user_id, display_name, team, hero)
    values ((select id from public.workspaces where slug = 'vertuoza'), '00000000-0000-4000-8000-00000000000c', 'CAROL', 'beaver',
            '{"v":1,"body":"girl","skin":0,"hair":0,"suit":0,"cape":0}');
    raise exception 'FAIL: a visitor joined a fleet without linking GitHub';
  exception when insufficient_privilege then null; end;
  if exists (select 1 from public.my_github()) then raise exception 'FAIL: my_github answered for an unlinked visitor'; end if;
  begin
    perform public.link_github();
    raise exception 'FAIL: link_github linked a visitor with no GitHub identity';
  exception when no_data_found then null; end;
end $$;

-- ── Acme's crew plays in Acme ──
select pg_temp.sign_in('00000000-0000-4000-8000-00000000000d', 'dan@acme.test');
do $$
begin
  insert into public.players (workspace_id, user_id, display_name, team, hero)
  values ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-00000000000d', 'DAN', 'roadrunners',
          '{"v":1,"body":"boy","skin":1,"hair":1,"suit":2,"cape":3}');
  if (select github_login from public.players where user_id = '00000000-0000-4000-8000-00000000000d') is distinct from 'dan-gh' then
    raise exception 'FAIL: a player of another workspace did not start with their linked GitHub account';
  end if;
end $$;

-- ── Isolation: a member of one workspace sees nothing of another, and cannot write there ──
do $$
declare
  me record;
  mine uuid;
  t text;
  n int;
begin
  for me in select * from (values
      ('00000000-0000-4000-8000-00000000000a', 'ada@vertuoza.com', 'vertuoza'),
      ('00000000-0000-4000-8000-00000000000d', 'dan@acme.test', 'acme')) as m (uid, email, slug) loop
    perform pg_temp.sign_in(me.uid, me.email);
    mine := (select id from public.workspaces where slug = me.slug);
    if mine is null then raise exception 'FAIL: % cannot read their own workspace', me.email; end if;
    if exists (select 1 from public.workspaces where id <> mine) then
      raise exception 'FAIL: % read another workspace', me.email;
    end if;
    foreach t in array array['workspace_members', 'sectors', 'teams', 'players', 'ledger_events'] loop
      execute format('select count(*) from public.%I where workspace_id <> $1', t) into n using mine;
      if n <> 0 then raise exception 'FAIL: % read % rows of another workspace''s public.%', me.email, n, t; end if;
      execute format('select count(*) from public.%I where workspace_id = $1', t) into n using mine;
      if n = 0 then raise exception 'FAIL: % cannot read their own workspace''s public.%', me.email, t; end if;
    end loop;
  end loop;

  perform pg_temp.sign_in('00000000-0000-4000-8000-00000000000a', 'ada@vertuoza.com');
  begin
    insert into public.players (workspace_id, user_id, display_name, team, hero)
    values ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-00000000000a', 'ADA', 'roadrunners',
            '{"v":1,"body":"girl","skin":2,"hair":3,"suit":0,"cape":8}');
    raise exception 'FAIL: a member inserted a player row in another workspace';
  exception when insufficient_privilege then null; end;
  begin
    update public.players set team = 'roadrunners' where user_id = '00000000-0000-4000-8000-00000000000a';
    raise exception 'FAIL: a player joined a fleet of another workspace';
  exception when foreign_key_violation then null; end;
end $$;

-- ── A freelancer plays in both workspaces, under one GitHub login ──
select pg_temp.sign_in('00000000-0000-4000-8000-00000000000f', 'fay@example.com');
do $$
declare hero constant jsonb := '{"v":1,"body":"girl","skin":4,"hair":5,"suit":6,"cape":7}';
begin
  insert into public.players (workspace_id, user_id, display_name, team, hero)
  select id, '00000000-0000-4000-8000-00000000000f', 'FAY', case slug when 'acme' then 'roadrunners' else 'pirates' end, hero
    from public.workspaces;
  if (select count(*) from public.players where github_login = 'fay-gh') <> 2 then
    raise exception 'FAIL: one GitHub login could not be a player in two workspaces';
  end if;
end $$;
reset role;
select pg_temp.sign_out();

-- Fay renames her GitHub account; linking again refreshes her player in every workspace.
update auth.identities set identity_data = '{"user_name": "fay-renamed"}' where user_id = '00000000-0000-4000-8000-00000000000f';
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-00000000000f', 'fay@example.com');
do $$
begin
  if public.link_github() ->> 'github_login' is distinct from 'fay-renamed' then
    raise exception 'FAIL: link_github did not answer the renamed GitHub account';
  end if;
  if (select array_agg(github_login) from public.players where user_id = auth.uid()) is distinct from array['fay-renamed', 'fay-renamed'] then
    raise exception 'FAIL: link_github did not refresh every player row of the caller';
  end if;
end $$;
reset role;
select pg_temp.sign_out();

-- ── Keys are per workspace ──
do $$
declare
  v constant uuid := (select id from public.workspaces where slug = 'vertuoza');
  shared text;
begin
  begin
    update public.players set github_login = 'ada-gh' where workspace_id = v and user_id = '00000000-0000-4000-8000-00000000000b';
    raise exception 'FAIL: one GitHub login is a player twice in one workspace';
  exception when unique_violation then null; end;
  begin
    update public.players set github_id = 424242 where workspace_id = v and user_id = '00000000-0000-4000-8000-00000000000b';
    raise exception 'FAIL: one GitHub id is a player twice in one workspace';
  exception when unique_violation then null; end;

  select e.id into shared from public.ledger_events e where e.workspace_id = '00000000-0000-4000-8000-0000000000a2';
  if (select count(distinct workspace_id) from public.ledger_events where id = shared) <> 2 then
    raise exception 'FAIL: one ledger id cannot exist in two workspaces';
  end if;
  begin
    insert into public.ledger_events (workspace_id, id, at, type, planet) values (v, shared, now(), 'PLANET_CHARTED', 1);
    raise exception 'FAIL: one ledger id was written twice in one workspace';
  exception when unique_violation then null; end;
end $$;

-- ── The game workflow (service role): reads everything, appends to the ledger, never rewrites it ──
do $$
declare t text;
begin
  foreach t in array array['public.workspaces', 'public.workspace_members', 'public.teams', 'public.sectors', 'public.players', 'public.ledger_events'] loop
    if not has_table_privilege('service_role', t, 'select') then raise exception 'FAIL: the workflow cannot read %', t; end if;
  end loop;
  foreach t in array array['public.workspaces', 'public.workspace_members', 'public.teams', 'public.sectors'] loop
    if not has_table_privilege('service_role', t, 'insert, update, delete') then raise exception 'FAIL: the service role cannot write %', t; end if;
  end loop;
  if not has_table_privilege('service_role', 'public.ledger_events', 'insert') then raise exception 'FAIL: the workflow cannot append'; end if;
  if has_table_privilege('service_role', 'public.ledger_events', 'update') or has_table_privilege('service_role', 'public.ledger_events', 'delete') then
    raise exception 'FAIL: the workflow may rewrite the ledger';
  end if;
  insert into public.ledger_events (workspace_id, id, at, type, planet)
  values ((select id from public.workspaces where slug = 'vertuoza'), 'check:planet:1:charted', now(), 'PLANET_CHARTED', 1);
  begin
    update public.ledger_events set planet = 2 where id = 'check:planet:1:charted';
    raise exception 'FAIL: the ledger was rewritten';
  exception when raise_exception then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  begin
    delete from public.ledger_events where id = 'check:planet:1:charted';
    raise exception 'FAIL: the ledger lost an event';
  exception when raise_exception then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
end $$;

-- ── Only the service role or a migration writes workspaces, memberships, sectors, fleets and the ledger ──
do $$
declare t text;
begin
  foreach t in array array['public.workspaces', 'public.workspace_members', 'public.teams', 'public.sectors', 'public.ledger_events'] loop
    if has_table_privilege('anon', t, 'insert, update, delete, truncate')
       or has_table_privilege('authenticated', t, 'insert, update, delete, truncate') then
      raise exception 'FAIL: a signed-in user may edit %', t;
    end if;
  end loop;
end $$;

-- ── The sign-up hook: a domain no workspace joins is refused, by a message naming no company ──
do $$
declare refusal jsonb;
begin
  if public.hook_before_user_created('{"user": {"email": "Ada@Vertuoza.com"}}') <> '{}'::jsonb then
    raise exception 'FAIL: the hook refused a vertuoza.com account';
  end if;
  if public.hook_before_user_created('{"user": {"email": "dan@acme.test"}}') <> '{}'::jsonb then
    raise exception 'FAIL: the hook refused the domain of a second workspace';
  end if;
  if public.hook_before_user_created('{"user": {"email": "eve@notvertuoza.com"}}') -> 'error' ->> 'http_code' is distinct from '403' then
    raise exception 'FAIL: the hook let a look-alike domain in';
  end if;
  refusal := public.hook_before_user_created('{"user": {"email": "eve@example.com"}}');
  if refusal -> 'error' ->> 'http_code' is distinct from '403' then
    raise exception 'FAIL: the hook let a domain in that no workspace joins';
  end if;
  if refusal -> 'error' ->> 'message' is distinct from 'OMNI LOOP is not open to example.com yet.' then
    raise exception 'FAIL: the hook''s refusal reads %', refusal -> 'error' ->> 'message';
  end if;
  if has_function_privilege('authenticated', 'public.hook_before_user_created(jsonb)', 'execute')
     or has_function_privilege('anon', 'public.hook_before_user_created(jsonb)', 'execute')
     or not has_function_privilege('supabase_auth_admin', 'public.hook_before_user_created(jsonb)', 'execute') then
    raise exception 'FAIL: the hook is callable by the wrong roles';
  end if;
end $$;

-- ── A theme holds known tokens only, each a #rrggbb colour ──
do $$
begin
  if not public.valid_theme('{}') or not public.valid_theme('{"plasma": "#2fc6a4", "plasma-dark": "#178a80", "stripe-4": "#5b7bff"}') then
    raise exception 'FAIL: valid_theme refused a valid theme';
  end if;
  if public.valid_theme('{"chartreuse": "#7fff00"}') then raise exception 'FAIL: valid_theme accepted an unknown token'; end if;
  if public.valid_theme('{"plasma": "red"}') or public.valid_theme('{"plasma": "#abc"}') or public.valid_theme('{"plasma": "#A45CFF"}')
     or public.valid_theme('{"plasma": 164}') then
    raise exception 'FAIL: valid_theme accepted a colour that is not #rrggbb';
  end if;
  if public.valid_theme('[]') or public.valid_theme('"#a45cff"') or public.valid_theme('null') then
    raise exception 'FAIL: valid_theme accepted a theme that is not an object';
  end if;
  begin
    update public.workspaces set theme = '{"plasma": "purple"}' where slug = 'vertuoza';
    raise exception 'FAIL: a workspace stored an invalid theme';
  exception when check_violation then null; end;
end $$;

select 'access checks passed' as result;
rollback;
