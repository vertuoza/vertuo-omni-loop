-- Who may make a Virtual Fleet, and who reads its heroes (PRD 2842 s1). The supabase workflow runs it on
-- every pull request, after `supabase db start` has applied the migrations and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/virtual_fleets.sql
-- Any member of a workspace creates a virtual fleet with its heroes through create_virtual_fleet(): the
-- fleet of kind `virtual`, its key from its name (BR-PRODUCT-47), its mascot one of fleet_mascots()
-- (BR-PRODUCT-46), the first swatch no active fleet wears, and one hero per role left on, each with
-- its role's defaults. A name whose key the workspace holds, retired fleets included, is refused as
-- `Name taken: choose another`; no role left on, an unknown role, an empty or long name and an unknown
-- mascot are refused naming their field. A player's fleet stays its owner's. A member reads the heroes,
-- an account of another workspace and anyone signed out nothing, and nobody signed in writes them. No
-- player joins a virtual fleet. A fleet made before reads as `crew`. One transaction, rolled back at the
-- end. Any `FAIL:` stops the run.

begin;

-- The checks' own workspace, Initech, with its fleets (five active, one retired), sectors and repositories.
\ir fixtures/initech.sql

-- ── The cast ──
-- Olga owns Initech and Mo is a member of it; Carl owns Acme.
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000042a1', 'olga@example.com', now()),
  ('00000000-0000-4000-8000-0000000042b1', 'mo@example.com', now()),
  ('00000000-0000-4000-8000-0000000042c1', 'carl@acme.test', now());
insert into public.workspaces (slug, name, github_org) values ('acme-virtual', 'Acme', 'acme-virtual');
insert into public.workspace_members (workspace_id, user_id, role)
select w.id, m.user_id, m.role
  from (values
         ('initech',      '00000000-0000-4000-8000-0000000042a1'::uuid, 'owner'),
         ('initech',      '00000000-0000-4000-8000-0000000042b1'::uuid, 'member'),
         ('acme-virtual', '00000000-0000-4000-8000-0000000042c1'::uuid, 'owner')
       ) as m (slug, user_id, role)
  join public.workspaces w on w.slug = m.slug;
-- A retired fleet, whose key stays taken.
insert into public.teams (workspace_id, name, label, color, sort, retired_at)
select w.id, 'ghost', 'GHOST', '#000000', 95, now() from public.workspaces w where w.slug = 'initech';

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create temporary table ids (slug text primary key, id uuid);
insert into ids select w.slug, w.id from public.workspaces w where w.slug in ('initech', 'acme-virtual');
grant select on ids to anon, authenticated;
create function pg_temp.ws(slug text) returns uuid language sql as $$
  select i.id from ids i where i.slug = ws.slug;
$$;
-- Initech's fleets and heroes, as one value to compare before and after a refusal.
create function pg_temp.state() returns text language sql security definer as $$
  select coalesce((select string_agg(row(t.*)::text, ';' order by t.name) from public.teams t where t.workspace_id = pg_temp.ws('initech')), '')
      || '|' || coalesce((select string_agg(row(h.*)::text, ';' order by h.fleet, h.position) from public.virtual_heroes h), '');
$$;
-- Runs a call that must be refused for its field: SQLSTATE 22023, the field as its hint, and a message
-- that starts with `word`.
create function pg_temp.refused_for(stmt text, field text, word text) returns void language plpgsql as $$
declare
  msg text;
  h text;
begin
  execute stmt;
  raise exception 'FAIL: % was not refused for its %', stmt, field;
exception when invalid_parameter_value then
  get stacked diagnostics msg = message_text, h = pg_exception_hint;
  if h is distinct from field or msg not like word || '%' then
    raise exception 'FAIL: % was refused without naming its %: % (hint %)', stmt, field, msg, h;
  end if;
end;
$$;
-- Runs a call that must be refused to its caller.
create function pg_temp.forbidden(stmt text, who text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % ran for %', stmt, who;
exception when insufficient_privilege then null;
end;
$$;

-- ── Every fleet made before is a players' fleet ──
do $$
begin
  if exists (select 1 from public.teams where kind <> 'crew') then
    raise exception 'FAIL: a fleet made before the migration does not read as crew';
  end if;
  begin
    update public.teams set kind = 'robots' where name = 'beaver';
    raise exception 'FAIL: a fleet took a kind that is neither crew nor virtual';
  exception when check_violation then null; end;
end $$;

-- ── Signed out, and an account of another workspace: refused, nothing changes ──
create temporary table before_state as select pg_temp.state() as s;
grant select on before_state to anon, authenticated;
create temporary table calls (stmt text);
insert into calls select format('select public.create_virtual_fleet(%L, ''NIGHT SHIFT'', ''robot'', array[''engineer''])', pg_temp.ws('initech'));
grant select on calls to anon, authenticated;

set local role anon;
do $$
declare c text;
begin
  for c in select stmt from calls loop perform pg_temp.forbidden(c, 'anon'); end loop;
  if exists (select 1 from public.virtual_heroes) then raise exception 'FAIL: anon read a virtual hero'; end if;
exception when insufficient_privilege then null;
end $$;
reset role;

set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000042c1');
do $$
declare c text;
begin
  for c in select stmt from calls loop perform pg_temp.forbidden(c, 'the owner of another workspace'); end loop;
end $$;
reset role;
do $$
begin
  if pg_temp.state() <> (select s from before_state) then raise exception 'FAIL: a refused call changed Initech''s fleets'; end if;
end $$;

-- ── A member, not the owner, creates a virtual fleet with its heroes ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000042b1');
do $$
declare
  v uuid := pg_temp.ws('initech');
  f public.teams;
  roles jsonb := public.virtual_hero_roles();
begin
  if public.is_owner(v) then raise exception 'FAIL: the member reads as the owner'; end if;
  -- A players' fleet stays an owner's.
  perform pg_temp.forbidden(format('select public.create_fleet(%L, ''RAIDERS'', ''#123456'')', v), 'a member making a players'' fleet');

  f := public.create_virtual_fleet(v, '  Night Shift ', 'robot', array['engineer', 'qa', 'reviewer', 'pm', 'architect']);
  if (f.workspace_id, f.name, f.label, f.kind, f.mascot, f.motto, f.retired_at)
       is distinct from (v, 'night-shift'::text, 'Night Shift'::text, 'virtual'::text, 'robot'::text, ''::text, null::timestamptz) then
    raise exception 'FAIL: a new virtual fleet is not as the member made it: %', row(f.*);
  end if;
  -- Initech's active fleets wear the first five swatches; the sixth's fleet is retired, so it is free.
  if f.color <> '#4fb0ff' then raise exception 'FAIL: a new virtual fleet wears % instead of the first free swatch', f.color; end if;
  if f.sort <= (select max(t.sort) from public.teams t where t.workspace_id = v and t.name <> 'night-shift') then
    raise exception 'FAIL: a new virtual fleet does not sort after the others';
  end if;

  -- One hero per role, in the drawer's order, each with its role's defaults.
  if (select count(*) from public.virtual_heroes h where h.fleet = 'night-shift') <> 5 then
    raise exception 'FAIL: a virtual fleet with five roles on has % heroes', (select count(*) from public.virtual_heroes h where h.fleet = 'night-shift');
  end if;
  if (select string_agg(h.role || ':' || h.name || ':' || h.position, ',' order by h.position) from public.virtual_heroes h where h.fleet = 'night-shift')
     <> 'engineer:Engineer:0,qa:QA:1,reviewer:Reviewer:2,pm:PM:3,architect:Architect:4' then
    raise exception 'FAIL: the heroes are not one per role in the drawer''s order';
  end if;
  if (select h.skills from public.virtual_heroes h where h.fleet = 'night-shift' and h.role = 'engineer')
     <> array['yolo', 'yolo-fix', 'wave', 'do-work', 'pr-care', 'bug-fix'] then
    raise exception 'FAIL: the Engineer does not run its role''s skills';
  end if;
  if exists (
    select 1 from public.virtual_heroes h
      join jsonb_array_elements(roles) as d (value) on d.value ->> 'role' = h.role
     where h.fleet = 'night-shift'
       and (h.agent <> d.value ->> 'agent' or h.model <> d.value ->> 'model'
            or h.skills <> array(select jsonb_array_elements_text(d.value -> 'skills'))
            or h.limits <> array(select jsonb_array_elements_text(d.value -> 'limits')))
  ) then
    raise exception 'FAIL: a hero does not start with its role''s defaults';
  end if;

  -- The roles left off make no hero; the next fleet wears the next free swatch.
  f := public.create_virtual_fleet(v, 'Day Shift', 'octopod', array['qa', 'engineer', 'qa']);
  if (select string_agg(h.role, ',' order by h.position) from public.virtual_heroes h where h.fleet = 'day-shift') <> 'engineer,qa' then
    raise exception 'FAIL: the roles left on did not make exactly their heroes';
  end if;
  if f.color <> '#ff6b8a' then raise exception 'FAIL: the second virtual fleet wears % instead of the next free swatch', f.color; end if;
end $$;

-- ── What a create refuses, naming its field ──
do $$
declare
  v uuid := pg_temp.ws('initech');
  before text := pg_temp.state();
begin
  -- A key the workspace holds: a players' fleet, a virtual one, a retired one, and a label whose key is taken.
  perform pg_temp.refused_for(format('select public.create_virtual_fleet(%L, ''Beaver'', ''robot'', array[''engineer''])', v), 'name', 'Name taken: choose another');
  perform pg_temp.refused_for(format('select public.create_virtual_fleet(%L, ''NIGHT SHIFT'', ''robot'', array[''engineer''])', v), 'name', 'Name taken: choose another');
  perform pg_temp.refused_for(format('select public.create_virtual_fleet(%L, ''Ghost'', ''robot'', array[''engineer''])', v), 'name', 'Name taken: choose another');
  perform pg_temp.refused_for(format('select public.create_virtual_fleet(%L, ''Cia!'', ''robot'', array[''engineer''])', v), 'name', 'Name taken: choose another');
  perform pg_temp.refused_for(format('select public.create_virtual_fleet(%L, ''   '', ''robot'', array[''engineer''])', v), 'name', 'Name:');
  perform pg_temp.refused_for(format('select public.create_virtual_fleet(%L, ''Thirteen char'', ''robot'', array[''engineer''])', v), 'name', 'Name:');
  perform pg_temp.refused_for(format('select public.create_virtual_fleet(%L, ''Owls'', ''dragon'', array[''engineer''])', v), 'mascot', 'Icon:');
  perform pg_temp.refused_for(format('select public.create_virtual_fleet(%L, ''Owls'', null, array[''engineer''])', v), 'mascot', 'Icon:');
  perform pg_temp.refused_for(format('select public.create_virtual_fleet(%L, ''Owls'', ''robot'', array[]::text[])', v), 'heroes', 'Heroes:');
  perform pg_temp.refused_for(format('select public.create_virtual_fleet(%L, ''Owls'', ''robot'', null)', v), 'heroes', 'Heroes:');
  perform pg_temp.refused_for(format('select public.create_virtual_fleet(%L, ''Owls'', ''robot'', array[''engineer'', ''designer''])', v), 'heroes', 'Heroes:');
  if pg_temp.state() <> before then raise exception 'FAIL: a refused create changed the fleets or heroes'; end if;
end $$;

-- ── A member reads the heroes, and writes none directly ──
do $$
declare v uuid := pg_temp.ws('initech');
begin
  if (select count(*) from public.virtual_heroes) <> 7 then raise exception 'FAIL: a member does not read their workspace''s heroes'; end if;
  begin
    insert into public.virtual_heroes (workspace_id, fleet, name, role, agent, model, position)
    values (v, 'night-shift', 'Planted', 'engineer', 'claude', 'sonnet', 9);
    raise exception 'FAIL: a member inserted a hero directly';
  exception when insufficient_privilege then null; end;
  begin
    update public.virtual_heroes set name = 'Ada' where fleet = 'night-shift';
    raise exception 'FAIL: a member renamed a hero directly';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.virtual_heroes where fleet = 'night-shift';
    raise exception 'FAIL: a member deleted a hero directly';
  exception when insufficient_privilege then null; end;
  if has_table_privilege('authenticated', 'public.virtual_heroes', 'insert') or has_table_privilege('authenticated', 'public.virtual_heroes', 'update')
     or has_table_privilege('authenticated', 'public.virtual_heroes', 'delete') then
    raise exception 'FAIL: authenticated holds a write grant on public.virtual_heroes';
  end if;
end $$;
reset role;

-- ── Another workspace reads none of them ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000042c1');
do $$
begin
  if exists (select 1 from public.virtual_heroes) then raise exception 'FAIL: Acme''s owner read Initech''s heroes'; end if;
  if exists (select 1 from public.teams where kind = 'virtual') then raise exception 'FAIL: Acme''s owner read Initech''s virtual fleets'; end if;
end $$;
reset role;

-- ── No player flies in a virtual fleet ──
do $$
declare
  v uuid := pg_temp.ws('initech');
  mo constant uuid := '00000000-0000-4000-8000-0000000042b1';
  hero constant jsonb := '{"v":1,"body":"girl","skin":2,"hair":3,"suit":0,"cape":8}';
begin
  begin
    insert into public.players (workspace_id, user_id, display_name, team, hero) values (v, mo, 'MO', 'night-shift', hero);
    raise exception 'FAIL: a player joined a virtual fleet';
  exception when check_violation then null; end;
  insert into public.players (workspace_id, user_id, display_name, team, hero) values (v, mo, 'MO', 'beaver', hero);
  begin
    update public.players set team = 'day-shift' where workspace_id = v and user_id = mo;
    raise exception 'FAIL: a player moved to a virtual fleet';
  exception when check_violation then null; end;
  if (select team from public.players where workspace_id = v and user_id = mo) <> 'beaver' then
    raise exception 'FAIL: a refused move changed the player''s fleet';
  end if;
end $$;

-- ── The cap of 12 active fleets holds for virtual ones ──
do $$
declare v uuid := pg_temp.ws('initech');
begin
  -- Five players' fleets and two virtual ones are active: five more fill the twelve.
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000042b1', 'role', 'authenticated')::text, true);
  perform public.create_virtual_fleet(v, n, 'robot', array['engineer']) from unnest(array['V1', 'V2', 'V3', 'V4', 'V5']) n;
  perform pg_temp.refused_for(format('select public.create_virtual_fleet(%L, ''V6'', ''robot'', array[''engineer''])', v), 'fleets', 'Fleets:');
end $$;

rollback;
