-- A mission inherits its fleet's level (PRD 2896 s2, docs: .omni-loop/delivery/inbox/2896-fleet-alone/spec.md, criteria
-- 2 and 3). It runs after 20270124090000_fleet_level.sql (teams.level) and 20270122093000_missions.sql (the mandate).
--
-- - mission_mandate_ok(): the mandate is {parallel} plus, optionally, level (with-you, own-branch or alone),
--   hardToRevert (a number from 0 to 1) and ownPrds (a whole number from 0 to 10). A mandate that holds only
--   {parallel}, every mission made before, stays valid and reads as with-you, 0.6 and 0.
-- - missions_level_guard(): a mission whose brief names no level takes its fleet's (a mission already in the
--   table keeps its own); a level above the fleet's is set only by a workspace owner (a signed-in member who is not
--   one is refused, SQLSTATE 42501). A write with no signed-in person (the service role) is not held to the rule.
-- - set_mission_level(): a member of the mission's workspace changes its level through it, "Change for this mission";
--   the guard decides. A delivered or stopped mission keeps the level it had.
--
-- Every statement can run twice. Nobody's grants change: only these functions write the mandate of a signed-in
-- person. Proven by supabase/checks/missions.sql.
-- Rollback: drop set_mission_level(), the trigger and missions_level_guard(), and put the {parallel}-only mandate back
-- in mission_mandate_ok() once no mission carries a level.

-- ── The mandate's shape ─────────────────────────────────────────────────────────────

create or replace function public.mission_mandate_ok(p_mandate jsonb) returns boolean
language plpgsql immutable
set search_path = ''
as $$
begin
  -- Never null, which a check reads as passing: an empty object, or none, is refused.
  if p_mandate is null or jsonb_typeof(p_mandate) <> 'object' or not (p_mandate ? 'parallel')
     or exists (select 1 from jsonb_object_keys(p_mandate) k where k not in ('parallel', 'level', 'hardToRevert', 'ownPrds')) then
    return false;
  end if;
  if not (jsonb_typeof(p_mandate -> 'parallel') = 'number' and (p_mandate ->> 'parallel') in ('1', '2', '3', '4')) then
    return false;
  end if;
  if p_mandate ? 'level' and not (jsonb_typeof(p_mandate -> 'level') = 'string'
                                  and (p_mandate ->> 'level') in ('with-you', 'own-branch', 'alone')) then
    return false;
  end if;
  if p_mandate ? 'hardToRevert' and not (jsonb_typeof(p_mandate -> 'hardToRevert') = 'number'
                                         and (p_mandate ->> 'hardToRevert')::numeric between 0 and 1) then
    return false;
  end if;
  if p_mandate ? 'ownPrds' and not (jsonb_typeof(p_mandate -> 'ownPrds') = 'number'
                                    and (p_mandate ->> 'ownPrds') in ('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10')) then
    return false;
  end if;
  return true;
end;
$$;

comment on column public.missions.mandate is
  'How a mission runs: {parallel: 1 to 4, level: with-you | own-branch | alone, hardToRevert: 0 to 1, ownPrds: 0 to 10}; only parallel is required, a mission without a level reads as with-you. It never merges into the default branch and never answers for a person, whatever the mandate.';

-- ── Who may set a mission's level ───────────────────────────────────────────────────

create or replace function public.missions_level_guard() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_fleet text;
  v_old text := case when tg_op = 'UPDATE' then old.mandate ->> 'level' else null end;
begin
  select t.level into v_fleet from public.teams t where t.workspace_id = new.workspace_id and t.name = new.fleet;
  v_fleet := coalesce(v_fleet, 'with-you');
  if new.mandate ->> 'level' is null then
    new.mandate := new.mandate || jsonb_build_object('level', coalesce(v_old, v_fleet));
    return new;
  end if;
  if new.mandate ->> 'level' is not distinct from v_old then
    return new;
  end if;
  if auth.uid() is not null
     and public.fleet_level_rank(new.mandate ->> 'level') > public.fleet_level_rank(v_fleet)
     and not public.is_owner(new.workspace_id) then
    raise exception 'Only an owner of the workspace starts a mission above its fleet''s level.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists missions_level_guard on public.missions;
create trigger missions_level_guard before insert or update of mandate on public.missions
  for each row execute function public.missions_level_guard();

-- A member changes one mission's level; the guard above decides whether this one may.
create or replace function public.set_mission_level(p_mission uuid, p_level text) returns public.missions
language plpgsql
security definer
set search_path = ''
as $$
declare
  made public.missions;
begin
  if auth.uid() is null or not exists (select 1 from public.missions m where m.id = p_mission and m.workspace_id in (select public.my_workspaces())) then
    raise exception 'Only a member of the mission''s workspace changes its level.' using errcode = '42501';
  end if;
  if public.fleet_level_rank(p_level) is null then
    raise exception 'Level: one of with-you, own-branch or alone.' using errcode = '22023', hint = 'level';
  end if;
  update public.missions m
     set mandate = m.mandate || jsonb_build_object('level', p_level), updated_at = now()
   where m.id = p_mission and m.status in ('draft', 'running', 'waiting', 'paused')
  returning * into made;
  if made.id is null then
    raise exception 'Level: a delivered or stopped mission keeps the one it had.' using errcode = '22023', hint = 'status';
  end if;
  return made;
end;
$$;

revoke execute on function public.missions_level_guard() from public, anon, authenticated;
revoke execute on function public.set_mission_level(uuid, text) from public, anon;
grant execute on function public.set_mission_level(uuid, text) to authenticated;
