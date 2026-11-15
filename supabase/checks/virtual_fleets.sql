-- Who may make a Virtual Fleet, and who reads its heroes (PRD 2842 s1, PRD 2873 s3). The supabase workflow runs it on
-- every pull request, after `supabase db start` has applied the migrations and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/virtual_fleets.sql
-- Any member of a workspace creates a virtual fleet with its heroes through create_virtual_fleet(): the
-- fleet of kind `virtual`, its key from its name (BR-PRODUCT-47), its mascot one of fleet_mascots()
-- (BR-PRODUCT-46), the first swatch no active fleet wears, and one hero per role left on, each with
-- its role's defaults. A name whose key the workspace holds, retired fleets included, is refused as
-- `Name taken: choose another`; no role left on, an unknown role, an empty or long name and an unknown
-- mascot are refused naming their field. A player's fleet stays its owner's. A member reads the heroes,
-- an account of another workspace and anyone signed out nothing, and nobody signed in writes them. No
-- player joins a virtual fleet. A fleet made before reads as `crew`. Six roles, the Designer last, each with
-- every skill of its role; 20270122121000_heroes_every_skill.sql, run again, gives every hero already made its
-- role's skills and leaves the rest of it, and a hero and a mission event accept `designer`. The Reviewer (PRD
-- 2871) runs `review` alone: 20270122122000_reviewer.sql, run again after heroes_every_skill, gives every Reviewer
-- `review` then `tech-review`, and its six limits only where its limits are still a default. One transaction,
-- rolled back at the end. Any `FAIL:` stops the run.

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

  f := public.create_virtual_fleet(v, '  Night Shift ', 'robot', array['engineer', 'qa', 'reviewer', 'pm', 'architect', 'designer']);
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
  if (select count(*) from public.virtual_heroes h where h.fleet = 'night-shift') <> 6 then
    raise exception 'FAIL: a virtual fleet with six roles on has % heroes', (select count(*) from public.virtual_heroes h where h.fleet = 'night-shift');
  end if;
  if (select string_agg(h.role || ':' || h.name || ':' || h.position, ',' order by h.position) from public.virtual_heroes h where h.fleet = 'night-shift')
     <> 'engineer:Engineer:0,qa:QA:1,reviewer:Reviewer:2,pm:PM:3,architect:Architect:4,designer:Designer:5' then
    raise exception 'FAIL: the heroes are not one per role in the drawer''s order';
  end if;
  if (select h.skills from public.virtual_heroes h where h.fleet = 'night-shift' and h.role = 'engineer')
     <> array['yolo', 'yolo-fix', 'wave', 'do-work', 'pr-care', 'bug-fix', 'mega-bug-fix', 'ultra-yolo', 'ultra-yolo-fix', 'ultra-wave', 'mega-pr-care', 'drive', 'mega-drive'] then
    raise exception 'FAIL: the Engineer does not list every skill of its role';
  end if;
  if (select (h.skills, h.agent, h.model, h.limits) from public.virtual_heroes h where h.fleet = 'night-shift' and h.role = 'designer')
     is distinct from (array['visual-fix', 'pixel-perfect', 'think-big'], 'claude'::text, 'opus'::text,
                       array['It never merges into the default branch.', 'It never answers for a person.', 'It never locks a screen: a person does.']) then
    raise exception 'FAIL: the Designer does not start with its skills, agent, model and limits';
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
  perform pg_temp.refused_for(format('select public.create_virtual_fleet(%L, ''Owls'', ''robot'', array[''engineer'', ''writer''])', v), 'heroes', 'Heroes: each one of engineer, qa, reviewer, pm, architect or designer.');
  if pg_temp.state() <> before then raise exception 'FAIL: a refused create changed the fleets or heroes'; end if;
end $$;

-- ── A member reads the heroes, and writes none directly ──
do $$
declare v uuid := pg_temp.ws('initech');
begin
  if (select count(*) from public.virtual_heroes) <> 8 then raise exception 'FAIL: a member does not read their workspace''s heroes'; end if;
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

-- ── An owner adds and removes a hero; a member, nobody else (PRD 2842 s6) ──
do $$
declare
  v uuid := pg_temp.ws('initech');
  olga constant text := '00000000-0000-4000-8000-0000000042a1';
  mo constant text := '00000000-0000-4000-8000-0000000042b1';
  carl constant text := '00000000-0000-4000-8000-0000000042c1';
  added public.virtual_heroes;
  before text;
begin
  before := pg_temp.state();
  -- A member who is no owner, an owner of another workspace and a signed-out call are all refused.
  perform set_config('request.jwt.claims', json_build_object('sub', mo, 'role', 'authenticated')::text, true);
  begin
    perform public.add_virtual_hero(v, 'day-shift', 'reviewer');
    raise exception 'FAIL: a member who is no owner added a hero';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claims', json_build_object('sub', carl, 'role', 'authenticated')::text, true);
  begin
    perform public.add_virtual_hero(v, 'day-shift', 'reviewer');
    raise exception 'FAIL: an owner of another workspace added a hero';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claims', '', true);
  begin
    perform public.add_virtual_hero(v, 'day-shift', 'reviewer');
    raise exception 'FAIL: a signed-out call added a hero';
  exception when insufficient_privilege then null; end;
  if pg_temp.state() <> before then raise exception 'FAIL: a refused add changed the heroes'; end if;

  -- The owner adds a role the fleet lacks, with its defaults, after the others.
  perform set_config('request.jwt.claims', json_build_object('sub', olga, 'role', 'authenticated')::text, true);
  added := public.add_virtual_hero(v, 'day-shift', 'reviewer');
  if (added.role, added.name, added.skills, added.agent, added.model, added.position) is distinct from ('reviewer', 'Reviewer', array['review', 'tech-review'], 'claude', 'opus', 2::smallint) then
    raise exception 'FAIL: the added hero is %', added;
  end if;
  perform pg_temp.refused_for(format('select public.add_virtual_hero(%L, ''day-shift'', ''reviewer'')', v), 'role', 'Role:');
  perform pg_temp.refused_for(format('select public.add_virtual_hero(%L, ''day-shift'', ''writer'')', v), 'role', 'Role: one of engineer, qa, reviewer, pm, architect or designer.');
  perform pg_temp.refused_for(format('select public.add_virtual_hero(%L, ''beaver'', ''qa'')', v), 'fleet', 'Fleet:');
  perform pg_temp.refused_for(format('select public.add_virtual_hero(%L, ''nowhere'', ''qa'')', v), 'fleet', 'Fleet:');

  -- Removal: an owner's only, never the last hero, never another workspace's.
  perform set_config('request.jwt.claims', json_build_object('sub', mo, 'role', 'authenticated')::text, true);
  begin
    perform public.remove_virtual_hero(v, added.id);
    raise exception 'FAIL: a member who is no owner removed a hero';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claims', json_build_object('sub', olga, 'role', 'authenticated')::text, true);
  perform pg_temp.refused_for(format('select public.remove_virtual_hero(%L, %L)', v, gen_random_uuid()), 'hero', 'Hero:');
  perform public.remove_virtual_hero(v, added.id);
  if exists (select 1 from public.virtual_heroes h where h.id = added.id) then raise exception 'FAIL: a removed hero is still there'; end if;
  perform public.remove_virtual_hero(v, (select h.id from public.virtual_heroes h where h.fleet = 'day-shift' and h.role = 'qa'));
  perform pg_temp.refused_for(format('select public.remove_virtual_hero(%L, %L)', v, (select h.id from public.virtual_heroes h where h.fleet = 'day-shift')), 'hero', 'Hero:');
  if (select count(*) from public.virtual_heroes h where h.fleet = 'day-shift') <> 1 then raise exception 'FAIL: the last hero was removed'; end if;
  -- A hero comes back after the others, never on a taken position.
  added := public.add_virtual_hero(v, 'day-shift', 'qa');
  if added.position <> 1 then raise exception 'FAIL: the hero added again took position %', added.position; end if;
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
reset role;

-- ── Six roles, and every hero already made lists its role's skills (PRD 2873 s3) ──
do $$
begin
  if (select string_agg(d.value ->> 'role', ',' order by d.n) from jsonb_array_elements(public.virtual_hero_roles()) with ordinality as d (value, n))
     <> 'engineer,qa,reviewer,pm,architect,designer' then
    raise exception 'FAIL: virtual_hero_roles() does not give the six roles in the drawer''s order';
  end if;
end $$;

-- Night Shift's heroes as PRD 2842 left them, each named, routed and limited by its owner.
create temporary table kept as
select h.id, h.role, h.name || ' (kept)' as name, 'codex' as agent, 'o9' as model, array['It keeps its owner''s limit.'] as limits, h.position
  from public.virtual_heroes h where h.fleet = 'night-shift';
update public.virtual_heroes h
   set skills = case h.role when 'engineer' then array['yolo', 'yolo-fix', 'wave', 'do-work', 'pr-care', 'bug-fix']
                            when 'qa' then array['prove', 'bug-fix'] when 'pm' then array['pitch', 'plan']
                            when 'architect' then array['plan'] else '{}'::text[] end,
       name = k.name, agent = k.agent, model = k.model, limits = k.limits
  from kept k where k.id = h.id;

\ir ../migrations/20270122121000_heroes_every_skill.sql

do $$
begin
  if exists (
    select 1 from public.virtual_heroes h
      join jsonb_array_elements(public.virtual_hero_roles()) as d (value) on d.value ->> 'role' = h.role
     where h.skills <> array(select jsonb_array_elements_text(d.value -> 'skills'))
  ) then
    raise exception 'FAIL: a hero already made does not list its role''s skills after the migration';
  end if;
  if (select h.skills from public.virtual_heroes h where h.fleet = 'night-shift' and h.role = 'pm')
     <> array['pitch', 'plan', 'brainstorm', 'roadmap', 'mega-brainstorm', 'mega-roadmap', 'mission'] then
    raise exception 'FAIL: the PM made before does not list every skill of its role';
  end if;
  if exists (
    select 1 from public.virtual_heroes h join kept k on k.id = h.id
     where (h.name, h.agent, h.model, h.limits, h.position) is distinct from (k.name, k.agent, k.model, k.limits, k.position)
  ) or (select count(*) from public.virtual_heroes h join kept k on k.id = h.id) <> 6 then
    raise exception 'FAIL: the migration changed a hero''s name, agent, model, limits or position';
  end if;
end $$;

-- ── The Reviewer runs its review alone (PRD 2871), after heroes_every_skill ──
-- A Reviewer still on PRD 2873's default limits, beside Night Shift's whose owner changed them.
insert into public.virtual_heroes (workspace_id, fleet, name, role, skills, agent, model, limits, position)
select pg_temp.ws('initech'), 'v2', 'Reviewer', 'reviewer', array['tech-review'], 'claude', 'opus',
       array['It never merges into the default branch.', 'It never answers for a person.', 'It never approves a pull request.'], 1;

\ir ../migrations/20270122122000_reviewer.sql

do $$
declare
  six text[] := array['It never merges into the default branch.', 'It never answers for a person.', 'It never approves on GitHub.',
                      'It marks ready on its pass only.', 'It raises five findings at most.', 'It reviews two rounds at most.'];
begin
  if exists (select 1 from public.virtual_heroes h where h.role = 'reviewer' and h.skills <> array['review', 'tech-review']) then
    raise exception 'FAIL: a Reviewer already made does not list review then tech-review';
  end if;
  if (select h.limits from public.virtual_heroes h where h.fleet = 'v2' and h.role = 'reviewer') is distinct from six then
    raise exception 'FAIL: a Reviewer on a default limit did not take its six limits';
  end if;
  if exists (
    select 1 from public.virtual_heroes h join kept k on k.id = h.id
     where (h.name, h.agent, h.model, h.limits, h.position) is distinct from (k.name, k.agent, k.model, k.limits, k.position)
  ) then
    raise exception 'FAIL: the Reviewer''s migration changed a hero its owner had changed';
  end if;
  if exists (
    select 1 from public.virtual_heroes h
      join jsonb_array_elements(public.virtual_hero_roles()) as d (value) on d.value ->> 'role' = h.role
     where h.skills <> array(select jsonb_array_elements_text(d.value -> 'skills'))
  ) then
    raise exception 'FAIL: a hero does not list its role''s skills after the Reviewer''s migration';
  end if;
end $$;

-- A hero and a mission event accept the Designer, and still refuse a role that is none.
do $$
declare v uuid := pg_temp.ws('initech');
begin
  begin
    insert into public.virtual_heroes (workspace_id, fleet, name, role, agent, model, position) values (v, 'day-shift', 'Writer', 'writer', 'claude', 'opus', 9);
    raise exception 'FAIL: a hero took the role writer';
  exception when check_violation then null; end;
  insert into public.virtual_heroes (workspace_id, fleet, name, role, agent, model, position)
  select v, 'v1', 'Designer', 'designer', 'claude', 'opus', 9;
  -- A role check runs before the mission's foreign key: `designer` passes it and meets the key, `writer` does not.
  begin
    insert into public.mission_events (mission_id, role, actor, kind, sentence) values (gen_random_uuid(), 'designer', 'agent', 'started', 'x');
    raise exception 'FAIL: a mission event of no mission was kept';
  exception when foreign_key_violation then null; end;
  begin
    insert into public.mission_events (mission_id, role, actor, kind, sentence) values (gen_random_uuid(), 'writer', 'agent', 'started', 'x');
    raise exception 'FAIL: a mission event of no mission was kept';
  exception when check_violation then null; end;
end $$;

-- ── A fleet's level (PRD 2896 s1): with-you unless an owner raised it ──
reset role;
-- The cap above filled the twelve: retire the five it made, so the levels below can make fleets.
update public.teams set retired_at = now() where name in ('v1', 'v2', 'v3', 'v4', 'v5');
do $$
begin
  if exists (select 1 from public.teams where level <> 'with-you') then
    raise exception 'FAIL: a fleet made before the level, or at its default, does not read with-you';
  end if;
  begin
    update public.teams set level = 'sometimes' where name = 'beaver';
    raise exception 'FAIL: a fleet took a level that is none of the three';
  exception when check_violation then null; end;
end $$;

-- A member who is not an owner creates at with-you, is refused a raised level, and a refusal changes nothing.
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000042b1');
do $$
declare
  v uuid := pg_temp.ws('initech');
  before text := pg_temp.state();
begin
  if public.is_owner(v) then raise exception 'FAIL: the member reads as the owner'; end if;
  perform pg_temp.forbidden(format('select public.create_virtual_fleet(%L, ''Raised'', ''robot'', array[''engineer''], ''own-branch'')', v), 'a member raising a level');
  perform pg_temp.forbidden(format('select public.create_virtual_fleet(%L, ''Raised'', ''robot'', array[''pm'', ''architect'', ''reviewer''], ''alone'')', v), 'a member raising a level');
  perform pg_temp.forbidden(format('select public.set_fleet_level(%L, ''night-shift'', ''own-branch'')', v), 'a member raising a level');
  perform pg_temp.refused_for(format('select public.create_virtual_fleet(%L, ''Raised'', ''robot'', array[''engineer''], ''sometimes'')', v), 'level', 'Level:');
  if pg_temp.state() <> before then raise exception 'FAIL: a refused level changed Initech''s fleets'; end if;
  if (public.create_virtual_fleet(v, 'Plain', 'robot', array['engineer'], 'with-you')).level <> 'with-you' then
    raise exception 'FAIL: a fleet made with no level does not read with-you';
  end if;
  if (public.create_virtual_fleet(v, 'Plain Two', 'robot', array['engineer'], 'with-you')).level <> 'with-you' then
    raise exception 'FAIL: a fleet made at with-you does not read with-you';
  end if;
end $$;
reset role;

-- An owner raises a level; Works alone needs a PM, an Architect and a Reviewer, at creation and afterwards.
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000042a1');
do $$
declare
  v uuid := pg_temp.ws('initech');
  f public.teams;
begin
  if (public.create_virtual_fleet(v, 'Branchy', 'robot', array['engineer'], 'own-branch')).level <> 'own-branch' then
    raise exception 'FAIL: an owner could not make a fleet at own-branch';
  end if;
  perform pg_temp.refused_for(format('select public.create_virtual_fleet(%L, ''Lone'', ''robot'', array[''engineer'', ''pm'', ''reviewer''], ''alone'')', v), 'level', 'Level: Works alone needs');
  if exists (select 1 from public.teams t where t.workspace_id = v and t.name = 'lone') then
    raise exception 'FAIL: a refused Works alone left a fleet behind';
  end if;
  f := public.create_virtual_fleet(v, 'Solo', 'robot', array['engineer', 'pm', 'architect', 'reviewer'], 'alone');
  if f.level <> 'alone' then raise exception 'FAIL: an owner could not make a fleet at alone: %', row(f.*); end if;

  perform pg_temp.refused_for(format('select public.set_fleet_level(%L, ''day-shift'', ''alone'')', v), 'level', 'Level: Works alone needs');
  perform pg_temp.refused_for(format('select public.set_fleet_level(%L, ''day-shift'', ''sometimes'')', v), 'level', 'Level:');
  perform pg_temp.refused_for(format('select public.set_fleet_level(%L, ''beaver'', ''own-branch'')', v), 'fleet', 'Fleet:');
  if (public.set_fleet_level(v, 'night-shift', 'alone')).level <> 'alone' then
    raise exception 'FAIL: an owner could not set a six-hero fleet to alone';
  end if;
end $$;
reset role;

-- Any member lowers it; a member who is not an owner cannot raise it again, nor a member of another workspace set it.
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000042b1');
do $$
declare v uuid := pg_temp.ws('initech');
begin
  if (public.set_fleet_level(v, 'night-shift', 'own-branch')).level <> 'own-branch' then
    raise exception 'FAIL: a member could not lower alone to own-branch';
  end if;
  if (public.set_fleet_level(v, 'night-shift', 'with-you')).level <> 'with-you' then
    raise exception 'FAIL: a member could not lower own-branch to with-you';
  end if;
  perform pg_temp.forbidden(format('select public.set_fleet_level(%L, ''night-shift'', ''own-branch'')', v), 'a member raising a level');
  perform pg_temp.forbidden(format('select public.set_fleet_level(%L, ''night-shift'', ''alone'')', v), 'a member raising a level');
end $$;
reset role;
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000042c1');
do $$
begin
  perform pg_temp.forbidden(format('select public.set_fleet_level(%L, ''night-shift'', ''with-you'')', pg_temp.ws('initech')), 'the owner of another workspace');
end $$;
reset role;
set local role anon;
do $$
begin
  perform pg_temp.forbidden(format('select public.set_fleet_level(%L, ''night-shift'', ''with-you'')', pg_temp.ws('initech')), 'anon');
end $$;
reset role;

rollback;
