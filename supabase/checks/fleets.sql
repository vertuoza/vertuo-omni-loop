-- Who may write the fleets (PRD 400). The supabase workflow runs it on every pull request, after
-- `supabase db start` has applied the migrations and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/fleets.sql
-- A workspace's owner, and only its owner, creates, restyles, retires and restores its fleets through
-- create_fleet(), update_fleet(), retire_fleet() and restore_fleet(). A member, the owner of another
-- workspace and anyone signed out are refused each one, and nothing changes. Each field is checked at
-- its edges and a refusal names its field; at most 12 fleets are active. A fleet's name is derived
-- from its label, unique in its workspace, and never changes. Nobody signed in writes public.teams
-- directly. The Vertuoza owner step of 20261003090000_own_fleets.sql is proven by applying that file
-- again once the member it names exists. One transaction, rolled back at the end. Any `FAIL:` stops
-- the run.

begin;

-- ── The cast ──
-- Olga owns Vertuoza and Mo is a member of it; Carl owns Acme, which starts with no fleet. Pierre is a
-- plain member of Vertuoza, with the GitHub login the migration names.
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000040a1', 'olga@vertuoza.com', now()),
  ('00000000-0000-4000-8000-0000000040b1', 'mo@vertuoza.com', now()),
  ('00000000-0000-4000-8000-0000000040c1', 'carl@acme.test', now()),
  ('00000000-0000-4000-8000-0000000040d1', 'pierre@vertuoza.com', now());
insert into auth.identities (user_id, provider, provider_id, identity_data) values
  ('00000000-0000-4000-8000-0000000040d1', 'github', '40401', '{"user_name": "PierreDerval"}');
insert into public.workspaces (slug, name, github_org) values ('acme-fleets', 'Acme', 'acme-fleets');
insert into public.workspace_members (workspace_id, user_id, role)
select w.id, m.user_id, m.role
  from (values
         ('vertuoza',    '00000000-0000-4000-8000-0000000040a1'::uuid, 'owner'),
         ('vertuoza',    '00000000-0000-4000-8000-0000000040b1'::uuid, 'member'),
         ('vertuoza',    '00000000-0000-4000-8000-0000000040d1'::uuid, 'member'),
         ('acme-fleets', '00000000-0000-4000-8000-0000000040c1'::uuid, 'owner')
       ) as m (slug, user_id, role)
  join public.workspaces w on w.slug = m.slug;

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
-- The workspaces' ids, read here once: a signed-in account reads only its own workspaces.
create temporary table ids (slug text primary key, id uuid);
insert into ids select w.slug, w.id from public.workspaces w where w.slug in ('vertuoza', 'acme-fleets');
grant select on ids to anon, authenticated;
create function pg_temp.ws(slug text) returns uuid language sql as $$
  select i.id from ids i where i.slug = ws.slug;
$$;
-- The workspace's fleets, as one value to compare before and after a refusal.
create function pg_temp.fleets(slug text) returns text language sql as $$
  select coalesce(string_agg(row(t.*)::text, ';' order by t.name), '')
    from public.teams t join public.workspaces w on w.id = t.workspace_id where w.slug = fleets.slug;
$$;
-- Runs a call that must be refused for its field: SQLSTATE 22023, the field as its hint, and a message
-- that starts by naming it.
create function pg_temp.refused_for(stmt text, field text, word text) returns void language plpgsql as $$
declare
  msg text;
  h text;
begin
  execute stmt;
  raise exception 'FAIL: % was not refused for its %', stmt, field;
exception when invalid_parameter_value then
  get stacked diagnostics msg = message_text, h = pg_exception_hint;
  if h is distinct from field or msg not like word || ':%' then
    raise exception 'FAIL: % was refused without naming its %: % (hint %)', stmt, field, msg, h;
  end if;
end;
$$;
-- Runs a call that must be refused to its caller, changing nothing.
create function pg_temp.forbidden(stmt text, who text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % ran for %', stmt, who;
exception when insufficient_privilege then null;
end;
$$;

create temporary table fleets_before (slug text primary key, fleets text);
insert into fleets_before select s, pg_temp.fleets(s) from unnest(array['vertuoza', 'acme-fleets']) s;

-- The calls every outsider tries, on Vertuoza's beaver fleet.
create temporary table calls (stmt text);
insert into calls
select format(c, pg_temp.ws('vertuoza'))
  from unnest(array[
    'select public.create_fleet(%L, ''RAIDERS'', ''#123456'', ''m'', ''beaver'')',
    'select public.update_fleet(%L, ''beaver'', ''HIJACKED'', ''#123456'', '''', null)',
    'select public.retire_fleet(%L, ''beaver'')',
    'select public.restore_fleet(%L, ''invincible-team'')'
  ]) c;
grant select on calls to anon, authenticated;

-- ── Signed out: every function refused ──
set local role anon;
do $$
declare c text;
begin
  for c in select stmt from calls loop perform pg_temp.forbidden(c, 'anon'); end loop;
  begin perform public.is_owner(pg_temp.ws('vertuoza')); raise exception 'FAIL: anon asked is_owner()';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── A member of Vertuoza, and Acme's owner: every function refused ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000040b1');
do $$
declare c text;
begin
  if public.is_owner(pg_temp.ws('vertuoza')) then raise exception 'FAIL: a member reads as the owner'; end if;
  for c in select stmt from calls loop perform pg_temp.forbidden(c, 'a member'); end loop;
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000040c1');
do $$
declare c text;
begin
  if not public.is_owner(pg_temp.ws('acme-fleets')) then raise exception 'FAIL: Acme''s owner does not read as its owner'; end if;
  if public.is_owner(pg_temp.ws('vertuoza')) then raise exception 'FAIL: Acme''s owner reads as Vertuoza''s'; end if;
  for c in select stmt from calls loop perform pg_temp.forbidden(c, 'the owner of another workspace'); end loop;
end $$;
reset role;
do $$
begin
  if pg_temp.fleets('vertuoza') <> (select fleets from fleets_before where slug = 'vertuoza') then
    raise exception 'FAIL: a refused call changed Vertuoza''s fleets';
  end if;
end $$;

-- ── Nobody signed in writes public.teams directly, the owner included ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000040a1');
do $$
begin
  begin
    insert into public.teams (workspace_id, name, label, color) values (pg_temp.ws('vertuoza'), 'planted', 'PLANTED', '#123456');
    raise exception 'FAIL: the owner inserted a fleet directly';
  exception when insufficient_privilege then null; end;
  begin
    update public.teams set label = 'RENAMED' where workspace_id = pg_temp.ws('vertuoza');
    raise exception 'FAIL: the owner updated a fleet directly';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.teams where workspace_id = pg_temp.ws('vertuoza');
    raise exception 'FAIL: the owner deleted a fleet directly';
  exception when insufficient_privilege then null; end;
  if has_table_privilege('authenticated', 'public.teams', 'insert') or has_table_privilege('authenticated', 'public.teams', 'update')
     or has_table_privilege('authenticated', 'public.teams', 'delete') then
    raise exception 'FAIL: authenticated holds a write grant on public.teams';
  end if;
end $$;

-- ── The owner creates, restyles, retires and restores a fleet ──
do $$
declare
  f public.teams;
  v uuid := pg_temp.ws('vertuoza');
begin
  if not public.is_owner(v) then raise exception 'FAIL: the owner does not read as the owner'; end if;

  f := public.create_fleet(v, '  Night Owls ', '#1A2B3C', ' Awake when CI is red. ', 'octopod');
  if (f.workspace_id, f.name, f.label, f.color, f.motto, f.mascot, f.retired_at)
       is distinct from (v, 'night-owls'::text, 'Night Owls'::text, '#1a2b3c'::text, 'Awake when CI is red.'::text, 'octopod'::text, null::timestamptz) then
    raise exception 'FAIL: a new fleet is not as the owner set it, named from its label: %', row(f.*);
  end if;
  if f.sort <= (select max(t.sort) from public.teams t where t.workspace_id = v and t.name <> 'night-owls') then
    raise exception 'FAIL: a new fleet does not sort after the others';
  end if;

  -- Its name is derived and unique in its workspace, retired fleets included, and never empty.
  if (public.create_fleet(v, 'C.I.A.', '#000000')).name <> 'c-i-a' then raise exception 'FAIL: "C.I.A." was not named c-i-a'; end if;
  if (public.create_fleet(v, 'Beaver', '#000000')).name <> 'beaver-2' then raise exception 'FAIL: a second beaver was not named beaver-2'; end if;
  if (public.create_fleet(v, 'beaver!', '#000000')).name <> 'beaver-3' then raise exception 'FAIL: a third beaver was not named beaver-3'; end if;
  perform public.retire_fleet(v, (public.create_fleet(v, 'Ghost', '#000000')).name);
  if (public.create_fleet(v, 'GHOST', '#000000')).name <> 'ghost-2' then
    raise exception 'FAIL: a retired fleet''s name was taken again';
  end if;
  if (public.create_fleet(v, '!!!', '#000000', '', '')).name <> 'fleet' then raise exception 'FAIL: a label of no letters was not named fleet'; end if;
  if (select mascot from public.teams where workspace_id = v and name = 'fleet') is not null then
    raise exception 'FAIL: an empty mascot was not stored as none';
  end if;
  -- Retired again, to leave room under the cap for the checks below.
  perform public.retire_fleet(v, n) from unnest(array['c-i-a', 'beaver-2', 'beaver-3', 'ghost-2', 'fleet']) n;

  -- A new look, the same name.
  f := public.update_fleet(v, 'night-owls', 'EARLY BIRDS', '#ffffff', '', null);
  if (f.name, f.label, f.color, f.motto, f.mascot) is distinct from ('night-owls'::text, 'EARLY BIRDS'::text, '#ffffff'::text, ''::text, null::text) then
    raise exception 'FAIL: an update did not restyle the fleet under its unchanged name: %', row(f.*);
  end if;
  if exists (select 1 from public.teams where workspace_id = v and name = 'early-birds') then
    raise exception 'FAIL: an update made a fleet under a new name';
  end if;

  -- Retired, then restored; retiring twice keeps the first date.
  f := public.retire_fleet(v, 'night-owls');
  if f.retired_at is null then raise exception 'FAIL: the owner did not retire a fleet'; end if;
  if (public.retire_fleet(v, 'night-owls')).retired_at <> f.retired_at then raise exception 'FAIL: retiring twice moved the date'; end if;
  f := public.restore_fleet(v, 'night-owls');
  if f.retired_at is not null or f.label <> 'EARLY BIRDS' then raise exception 'FAIL: the owner did not restore a fleet with its look'; end if;
  if (public.restore_fleet(v, 'night-owls')).retired_at is not null then raise exception 'FAIL: restoring an active fleet retired it'; end if;

  -- A fleet that is not there.
  begin
    perform public.update_fleet(v, 'nobody', 'X', '#000000');
    raise exception 'FAIL: an update of a missing fleet went through';
  exception when no_data_found then null; end;
  begin
    perform public.retire_fleet(pg_temp.ws('acme-fleets'), 'beaver');
    raise exception 'FAIL: Vertuoza''s owner retired a fleet of Acme';
  exception when insufficient_privilege then null; end;
end $$;

-- ── Every field at its edges, each refusal naming its field ──
do $$
declare v uuid := pg_temp.ws('vertuoza');
begin
  perform pg_temp.refused_for(format('select public.create_fleet(%L, '''', ''#000000'')', v), 'label', 'Label');
  perform pg_temp.refused_for(format('select public.create_fleet(%L, ''   '', ''#000000'')', v), 'label', 'Label');
  perform pg_temp.refused_for(format('select public.create_fleet(%L, null, ''#000000'')', v), 'label', 'Label');
  perform pg_temp.refused_for(format('select public.create_fleet(%L, ''ABCDEFGHIJKLM'', ''#000000'')', v), 'label', 'Label');
  if (public.create_fleet(v, 'A', '#000000')).label <> 'A' then raise exception 'FAIL: a label of 1 character was refused'; end if;
  if (public.create_fleet(v, 'ABCDEFGHIJKL', '#000000')).label <> 'ABCDEFGHIJKL' then raise exception 'FAIL: a label of 12 characters was refused'; end if;

  perform pg_temp.refused_for(format('select public.create_fleet(%L, ''HUE'', ''red'')', v), 'color', 'Colour');
  perform pg_temp.refused_for(format('select public.create_fleet(%L, ''HUE'', ''#12345'')', v), 'color', 'Colour');
  perform pg_temp.refused_for(format('select public.create_fleet(%L, ''HUE'', ''#1234567'')', v), 'color', 'Colour');
  perform pg_temp.refused_for(format('select public.create_fleet(%L, ''HUE'', ''#12345g'')', v), 'color', 'Colour');
  perform pg_temp.refused_for(format('select public.create_fleet(%L, ''HUE'', ''123456'')', v), 'color', 'Colour');
  perform pg_temp.refused_for(format('select public.create_fleet(%L, ''HUE'', null)', v), 'color', 'Colour');

  perform pg_temp.refused_for(format('select public.create_fleet(%L, ''MOTTO'', ''#000000'', %L)', v, repeat('m', 61)), 'motto', 'Motto');
  if char_length((public.create_fleet(v, 'MOTTO', '#000000', repeat('m', 60))).motto) <> 60 then
    raise exception 'FAIL: a motto of 60 characters was refused';
  end if;

  perform pg_temp.refused_for(format('select public.create_fleet(%L, ''MASCOT'', ''#000000'', '''', ''dragon'')', v), 'mascot', 'Mascot');
  perform pg_temp.refused_for(format('select public.create_fleet(%L, ''MASCOT'', ''#000000'', '''', ''pirates'')', v), 'mascot', 'Mascot');
  perform pg_temp.refused_for(format('select public.create_fleet(%L, ''MASCOT'', ''#000000'', '''', ''entropy'')', v), 'mascot', 'Mascot');
  if (public.create_fleet(v, 'MASCOT', '#000000', '', 'pirate')).mascot <> 'pirate' then raise exception 'FAIL: a known mascot was refused'; end if;

  -- An update checks the same fields.
  perform pg_temp.refused_for(format('select public.update_fleet(%L, ''beaver'', ''ABCDEFGHIJKLM'', ''#000000'')', v), 'label', 'Label');
  perform pg_temp.refused_for(format('select public.update_fleet(%L, ''beaver'', ''BEAVER'', ''brown'')', v), 'color', 'Colour');
  perform pg_temp.refused_for(format('select public.update_fleet(%L, ''beaver'', ''BEAVER'', ''#000000'', %L)', v, repeat('m', 61)), 'motto', 'Motto');
  perform pg_temp.refused_for(format('select public.update_fleet(%L, ''beaver'', ''BEAVER'', ''#000000'', '''', ''dragon'')', v), 'mascot', 'Mascot');
  if (select label from public.teams where workspace_id = v and name = 'beaver') <> 'BEAVER' then
    raise exception 'FAIL: a refused update changed the fleet';
  end if;
end $$;
reset role;

-- ── At most 12 active fleets, in Acme, which starts with none ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000040c1');
do $$
declare
  a uuid := pg_temp.ws('acme-fleets');
  i int;
begin
  if exists (select 1 from public.teams where workspace_id = a) then raise exception 'FAIL: a new workspace has fleets'; end if;
  for i in 1..12 loop perform public.create_fleet(a, 'F' || i, '#000000'); end loop;
  perform pg_temp.refused_for(format('select public.create_fleet(%L, ''F13'', ''#000000'')', a), 'fleets', 'Fleets');
  perform public.retire_fleet(a, 'f1');
  perform public.create_fleet(a, 'F13', '#000000');
  perform pg_temp.refused_for(format('select public.restore_fleet(%L, ''f1'')', a), 'fleets', 'Fleets');
  if (select count(*) from public.teams where workspace_id = a and retired_at is null) <> 12 then
    raise exception 'FAIL: Acme has other than 12 active fleets';
  end if;
  if (select retired_at from public.teams where workspace_id = a and name = 'f1') is null then
    raise exception 'FAIL: a refused restore restored the fleet';
  end if;
  perform public.retire_fleet(a, 'f2');
  if (public.restore_fleet(a, 'f1')).retired_at is not null then raise exception 'FAIL: a restore with room was refused'; end if;
  -- An update of an active fleet is not a 13th.
  perform public.update_fleet(a, 'f3', 'F3 AGAIN', '#000000');
end $$;
reset role;

-- ── Vertuoza's owner: the member whose GitHub login is pierrederval ──
do $$
begin
  if (select role from public.workspace_members m join public.workspaces w on w.id = m.workspace_id
       where w.slug = 'vertuoza' and m.user_id = '00000000-0000-4000-8000-0000000040d1') <> 'member' then
    raise exception 'FAIL: the cast is not as this check assumes';
  end if;
end $$;
\ir ../migrations/20261003090000_own_fleets.sql
do $$
begin
  if (select role from public.workspace_members m join public.workspaces w on w.id = m.workspace_id
       where w.slug = 'vertuoza' and m.user_id = '00000000-0000-4000-8000-0000000040d1') <> 'owner' then
    raise exception 'FAIL: the member whose GitHub login is pierrederval does not own vertuoza';
  end if;
  if (select role from public.workspace_members m join public.workspaces w on w.id = m.workspace_id
       where w.slug = 'vertuoza' and m.user_id = '00000000-0000-4000-8000-0000000040b1') <> 'member' then
    raise exception 'FAIL: the owner step made another member an owner';
  end if;
  if (select role from public.workspace_members m join public.workspaces w on w.id = m.workspace_id
       where w.slug = 'acme-fleets' and m.user_id = '00000000-0000-4000-8000-0000000040c1') <> 'owner' then
    raise exception 'FAIL: the owner step changed another workspace';
  end if;
end $$;

select 'fleet checks passed' as result;
rollback;
