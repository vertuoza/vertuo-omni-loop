-- A Virtual Fleet has a level (PRD 2896 s1, docs: .omni-loop/delivery/inbox/2896-fleet-alone/spec.md, criteria 1 and 12):
-- `with-you` (a mission runs as it does today, the default), `own-branch` or `alone`. It runs after
-- 20270122122000_reviewer.sql and builds on 20270122090000_virtual_fleets.sql and 20270122121000_heroes_every_skill.sql.
--
-- - public.teams.level: a checked text column, `with-you` by default, as `teams.kind` is. Every fleet made before reads
--   `with-you`, so nothing changes for it.
-- - teams_level_guard(): only a workspace owner raises a level (a signed-in member who is not one is refused,
--   SQLSTATE 42501), any member lowers it, and a fleet is set to `alone` only while it holds a PM, an Architect and a
--   Reviewer (SQLSTATE 22023, hint `level`). A write with no signed-in person (the service role, a migration) is not a
--   person's and is not held to the owner rule.
-- - set_fleet_level(): a member of the workspace sets a virtual fleet's level through it; the guard decides.
-- - create_virtual_fleet(): takes the level as a fifth argument, with no default (an older migration run again brings
--   the four-argument form back, and a default would make a four-argument call ambiguous); the four-argument form stays
--   and makes a fleet at `with-you`. The body is otherwise as 20270122121000_heroes_every_skill.sql left it.
--
-- Every statement can run twice. Nobody's grants change: a member still reads public.teams and only these functions
-- write it. Proven by supabase/checks/virtual_fleets.sql.
-- Rollback: a follow-up migration that drops the five-argument create_virtual_fleet(), set_fleet_level(), the trigger,
-- teams_level_guard(), fleet_has_mission_roles() and fleet_level_rank(), and drops public.teams.level, once no fleet
-- is above `with-you` (a mission started on one keeps `mandate.level` in its own row).

-- ── The column ────────────────────────────────────────────────────────────────────

alter table public.teams add column if not exists level text not null default 'with-you';
alter table public.teams drop constraint if exists teams_level;
alter table public.teams add constraint teams_level check (level in ('with-you', 'own-branch', 'alone'));

comment on column public.teams.level is
  'How far a Virtual Fleet''s missions run without a person (PRD 2896): with-you (today''s behaviour, the default), own-branch or alone. Only a workspace owner raises it, any member lowers it, and alone needs a PM, an Architect and a Reviewer.';

-- ── Who may set it ────────────────────────────────────────────────────────────────

create or replace function public.fleet_level_rank(p_level text) returns int
language sql immutable
set search_path = ''
as $$
  select case p_level when 'with-you' then 0 when 'own-branch' then 1 when 'alone' then 2 else null end
$$;

-- True when the fleet holds a PM, an Architect and a Reviewer: what `alone` needs.
create or replace function public.fleet_has_mission_roles(p_workspace uuid, p_fleet text) returns boolean
language sql stable
set search_path = ''
as $$
  select (select count(distinct h.role) from public.virtual_heroes h
           where h.workspace_id = p_workspace and h.fleet = p_fleet and h.role in ('pm', 'architect', 'reviewer')) = 3
$$;

create or replace function public.teams_level_guard() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  was text := case when tg_op = 'INSERT' then 'with-you' else old.level end;
begin
  if new.level is not distinct from was then
    return new;
  end if;
  if auth.uid() is not null
     and public.fleet_level_rank(new.level) > public.fleet_level_rank(was)
     and not public.is_owner(new.workspace_id) then
    raise exception 'Only an owner of the workspace raises a fleet''s level.' using errcode = '42501';
  end if;
  if new.level = 'alone' and not public.fleet_has_mission_roles(new.workspace_id, new.name) then
    raise exception 'Level: Works alone needs a PM, an Architect and a Reviewer.' using errcode = '22023', hint = 'level';
  end if;
  return new;
end;
$$;

drop trigger if exists teams_level_guard on public.teams;
create trigger teams_level_guard before insert or update of level on public.teams
  for each row execute function public.teams_level_guard();

-- A member sets a virtual fleet's level; the guard above decides whether this one may.
create or replace function public.set_fleet_level(p_workspace uuid, p_fleet text, p_level text) returns public.teams
language plpgsql
security definer
set search_path = ''
as $$
declare
  made public.teams;
begin
  if auth.uid() is null or p_workspace is null or not public.is_member(p_workspace) then
    raise exception 'Only a member of the workspace sets its fleets'' level.' using errcode = '42501';
  end if;
  if public.fleet_level_rank(p_level) is null then
    raise exception 'Level: one of with-you, own-branch or alone.' using errcode = '22023', hint = 'level';
  end if;
  update public.teams t set level = p_level
   where t.workspace_id = p_workspace and t.name = p_fleet and t.kind = 'virtual'
  returning * into made;
  if made.name is null then
    raise exception 'Fleet: no virtual fleet of that name.' using errcode = '22023', hint = 'fleet';
  end if;
  return made;
end;
$$;

-- ── Creating one, at a level ──────────────────────────────────────────────────────

-- The four-argument form stays as it is (a fleet at `with-you`); the app calls this one.
create or replace function public.create_virtual_fleet(
  p_workspace uuid, p_name text, p_mascot text, p_roles text[], p_level text
) returns public.teams
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_label text := btrim(coalesce(p_name, ''));
  v_mascot text := nullif(btrim(coalesce(p_mascot, '')), '');
  v_level text := coalesce(p_level, 'with-you');
  v_roles jsonb := public.virtual_hero_roles();
  picked text[];
  v_key text;
  colour text;
  made public.teams;
begin
  if auth.uid() is null or p_workspace is null or not public.is_member(p_workspace) then
    raise exception 'Only a member of the workspace creates its virtual fleets.' using errcode = '42501';
  end if;
  if char_length(v_label) not between 1 and 12 then
    raise exception 'Name: 1 to 12 characters.' using errcode = '22023', hint = 'name';
  end if;
  if v_mascot is null or not (v_mascot = any (public.fleet_mascots())) then
    raise exception 'Icon: one of %.', array_to_string(public.fleet_mascots(), ', ') using errcode = '22023', hint = 'mascot';
  end if;
  select array_agg(distinct r) into picked from unnest(coalesce(p_roles, '{}')) r;
  if picked is null then
    raise exception 'Heroes: leave at least one on.' using errcode = '22023', hint = 'heroes';
  end if;
  if exists (select 1 from unnest(picked) r where not exists (select 1 from jsonb_array_elements(v_roles) as d (value) where d.value ->> 'role' = r)) then
    raise exception 'Heroes: each one of engineer, qa, reviewer, pm, architect or designer.' using errcode = '22023', hint = 'heroes';
  end if;
  if public.fleet_level_rank(v_level) is null then
    raise exception 'Level: one of with-you, own-branch or alone.' using errcode = '22023', hint = 'level';
  end if;
  if public.fleet_level_rank(v_level) > 0 and not public.is_owner(p_workspace) then
    raise exception 'Only an owner of the workspace raises a fleet''s level.' using errcode = '42501';
  end if;
  if v_level = 'alone' and not (picked @> array['pm', 'architect', 'reviewer']) then
    raise exception 'Level: Works alone needs a PM, an Architect and a Reviewer.' using errcode = '22023', hint = 'level';
  end if;

  -- Two members' clicks never race past the cap or to one name (create_fleet() takes the same lock).
  perform pg_advisory_xact_lock(hashtext('fleets:' || p_workspace::text));
  perform public.fleet_room(p_workspace);

  v_key := coalesce(nullif(btrim(regexp_replace(lower(v_label), '[^a-z0-9]+', '-', 'g'), '-'), ''), 'fleet');
  if exists (select 1 from public.teams t where t.workspace_id = p_workspace and t.name = v_key) then
    raise exception 'Name taken: choose another' using errcode = '22023', hint = 'name';
  end if;

  select c into colour
    from unnest(public.virtual_fleet_colors()) with ordinality as s (c, n)
   where not exists (select 1 from public.teams t where t.workspace_id = p_workspace and t.retired_at is null and t.color = s.c)
   order by n
   limit 1;

  -- The fleet is made at `with-you` and raised once its heroes are in, so the guard sees them.
  insert into public.teams (workspace_id, name, label, color, motto, mascot, sort, kind)
  values (p_workspace, v_key, v_label, coalesce(colour, (public.virtual_fleet_colors())[1]), '', v_mascot,
          coalesce((select max(t.sort) from public.teams t where t.workspace_id = p_workspace), 0) + 10, 'virtual')
  returning * into made;

  insert into public.virtual_heroes (workspace_id, fleet, name, role, skills, agent, model, limits, position)
  select p_workspace, v_key, d.value ->> 'name', d.value ->> 'role',
         array(select jsonb_array_elements_text(d.value -> 'skills')),
         d.value ->> 'agent', d.value ->> 'model',
         array(select jsonb_array_elements_text(d.value -> 'limits')),
         (d.n - 1)::smallint
    from jsonb_array_elements(v_roles) with ordinality as d (value, n)
   where d.value ->> 'role' = any (picked);

  if v_level <> 'with-you' then
    update public.teams t set level = v_level where t.workspace_id = p_workspace and t.name = v_key returning * into made;
  end if;
  return made;
end;
$$;

-- ── Who may call what ─────────────────────────────────────────────────────────────

revoke execute on function public.fleet_level_rank(text) from public;
grant execute on function public.fleet_level_rank(text) to authenticated, service_role;
revoke execute on function public.fleet_has_mission_roles(uuid, text) from public, anon;
grant execute on function public.fleet_has_mission_roles(uuid, text) to authenticated, service_role;
revoke execute on function public.teams_level_guard() from public, anon, authenticated;
revoke execute on function public.set_fleet_level(uuid, text, text) from public, anon;
grant execute on function public.set_fleet_level(uuid, text, text) to authenticated;
revoke execute on function public.create_virtual_fleet(uuid, text, text, text[], text) from public, anon;
grant execute on function public.create_virtual_fleet(uuid, text, text, text[], text) to authenticated;
