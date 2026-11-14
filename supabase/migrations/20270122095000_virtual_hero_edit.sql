-- Adding and removing a Virtual Hero (PRD 2842 s6, docs: .omni-loop/delivery/inbox/2842-missions/spec.md).
-- The Heroes tab of a Virtual Fleet lets an owner of the workspace add a hero of a role the fleet lacks, or
-- remove one, as the signed-in person: nobody signed in writes public.virtual_heroes directly
-- (20270122090000_virtual_fleets.sql), so each goes through a security definer function that checks the
-- caller owns the workspace. A new hero copies its role's defaults from virtual_hero_roles(), as
-- create_virtual_fleet() does; a fleet holds one hero per role and at least one hero.
-- Each refusal names its field first and carries it as the hint (ADR-0050): `role` or `hero`.
--
-- Every statement can run twice.
-- Proven by supabase/checks/virtual_fleets.sql.
-- Rollback: a follow-up migration drops add_virtual_hero(uuid, text, text) and remove_virtual_hero(uuid, uuid).

create or replace function public.add_virtual_hero(p_workspace uuid, p_fleet text, p_role text)
returns public.virtual_heroes
language plpgsql
security definer
set search_path = ''
as $$
declare
  d jsonb;
  made public.virtual_heroes;
begin
  if auth.uid() is null or p_workspace is null or not public.is_owner(p_workspace) then
    raise exception 'Only an owner of the workspace adds a hero.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.teams t where t.workspace_id = p_workspace and t.name = p_fleet and t.kind = 'virtual' and t.retired_at is null) then
    raise exception 'Fleet: not a virtual fleet of this workspace.' using errcode = '22023', hint = 'fleet';
  end if;
  select e.value into d from jsonb_array_elements(public.virtual_hero_roles()) as e (value) where e.value ->> 'role' = p_role;
  if d is null then
    raise exception 'Role: one of engineer, qa, reviewer, pm or architect.' using errcode = '22023', hint = 'role';
  end if;
  perform pg_advisory_xact_lock(hashtext('heroes:' || p_workspace::text || ':' || p_fleet));
  if exists (select 1 from public.virtual_heroes h where h.workspace_id = p_workspace and h.fleet = p_fleet and h.role = p_role) then
    raise exception 'Role: this fleet already has that hero.' using errcode = '22023', hint = 'role';
  end if;
  insert into public.virtual_heroes (workspace_id, fleet, name, role, skills, agent, model, limits, position)
  values (p_workspace, p_fleet, d ->> 'name', d ->> 'role',
          array(select jsonb_array_elements_text(d -> 'skills')), d ->> 'agent', d ->> 'model',
          array(select jsonb_array_elements_text(d -> 'limits')),
          coalesce((select max(h.position) from public.virtual_heroes h where h.workspace_id = p_workspace and h.fleet = p_fleet), -1) + 1)
  returning * into made;
  return made;
end;
$$;

create or replace function public.remove_virtual_hero(p_workspace uuid, p_hero uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fleet text;
begin
  if auth.uid() is null or p_workspace is null or not public.is_owner(p_workspace) then
    raise exception 'Only an owner of the workspace removes a hero.' using errcode = '42501';
  end if;
  select h.fleet into v_fleet from public.virtual_heroes h where h.id = p_hero and h.workspace_id = p_workspace;
  if v_fleet is null then
    raise exception 'Hero: not a hero of this workspace.' using errcode = '22023', hint = 'hero';
  end if;
  perform pg_advisory_xact_lock(hashtext('heroes:' || p_workspace::text || ':' || v_fleet));
  if (select count(*) from public.virtual_heroes h where h.workspace_id = p_workspace and h.fleet = v_fleet) <= 1 then
    raise exception 'Hero: a fleet keeps at least one hero.' using errcode = '22023', hint = 'hero';
  end if;
  delete from public.virtual_heroes h where h.id = p_hero;
end;
$$;

revoke execute on function public.add_virtual_hero(uuid, text, text) from public, anon;
grant execute on function public.add_virtual_hero(uuid, text, text) to authenticated;
revoke execute on function public.remove_virtual_hero(uuid, uuid) from public, anon;
grant execute on function public.remove_virtual_hero(uuid, uuid) to authenticated;
