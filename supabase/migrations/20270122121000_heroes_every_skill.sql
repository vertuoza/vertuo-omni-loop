-- Every Virtual Hero lists all its role's skills (PRD 2873 s3, docs: .omni-loop/delivery/inbox/2873-heroes-every-skill/spec.md,
-- "Every hero lists every skill of its role").
--
-- - A sixth role, `designer`, which a hero (public.virtual_heroes) and a mission event (public.mission_events) accept.
-- - virtual_hero_roles() gives the six roles, in the drawer's order, each with every kit skill of its role: the list
--   kit/lib/virtual-fleet/roles.ts › ROLES holds (apps/galaxy/src/virtual-fleets/roles-sql.test.ts holds the two equal).
--   The Reviewer starts with `tech-review` and the limit `It never approves a pull request.` in place of `It has no skill
--   to run yet.`; the Designer with `visual-fix`, `pixel-perfect` and `think-big`, claude and opus, and its own limits.
-- - create_virtual_fleet() and add_virtual_hero() name the six roles when they refuse an unknown one; nothing else in
--   them changes (the same signature, rules, locks and grants).
-- - Every hero already made gets its role's skills, in its role's order. Its name, agent, model, limits and position
--   stay as they are.
--
-- Every statement can run twice: supabase/checks/virtual_fleets.sql runs it again over heroes made with PRD 2842's
-- skills, and proves each part.
-- Rollback: a follow-up migration that puts back virtual_hero_roles(), create_virtual_fleet() and add_virtual_hero()
-- from 20270122090000_virtual_fleets.sql and 20270122095000_virtual_hero_edit.sql, and the two role checks without
-- `designer` once no hero or event holds it. Heroes keep the skills they were given.

-- ── The roles a hero and an event accept ──────────────────────────────────────────

alter table public.virtual_heroes drop constraint if exists virtual_heroes_role;
alter table public.virtual_heroes add constraint virtual_heroes_role
  check (role in ('engineer', 'qa', 'reviewer', 'pm', 'architect', 'designer'));

alter table public.mission_events drop constraint if exists mission_events_role_check;
alter table public.mission_events add constraint mission_events_role_check
  check (role in ('pm', 'engineer', 'architect', 'qa', 'reviewer', 'designer', 'supervisor'));

-- ── What a new hero starts with ───────────────────────────────────────────────────

-- The roles a new hero may take, in the drawer's order, with the defaults it starts with: the list of
-- kit/lib/virtual-fleet/roles.ts › ROLES, as one JSON array between the $json$ markers.
create or replace function public.virtual_hero_roles() returns jsonb
language sql immutable
set search_path = ''
as $$
  select $json$[
    {"role": "engineer", "name": "Engineer", "skills": ["yolo", "yolo-fix", "wave", "do-work", "pr-care", "bug-fix", "mega-bug-fix", "ultra-yolo", "ultra-yolo-fix", "ultra-wave", "mega-pr-care", "drive", "mega-drive"], "agent": "claude", "model": "sonnet", "limits": ["It never merges into the default branch.", "It never answers for a person.", "It waits for a person wherever one is needed."]},
    {"role": "qa", "name": "QA", "skills": ["prove", "bug-fix", "validate-e2e"], "agent": "claude", "model": "sonnet", "limits": ["It never merges into the default branch.", "It never answers for a person.", "It reports what it saw; a person decides."]},
    {"role": "reviewer", "name": "Reviewer", "skills": ["tech-review"], "agent": "claude", "model": "opus", "limits": ["It never merges into the default branch.", "It never answers for a person.", "It never approves a pull request."]},
    {"role": "pm", "name": "PM", "skills": ["pitch", "plan", "brainstorm", "roadmap", "mega-brainstorm", "mega-roadmap", "mission"], "agent": "claude", "model": "opus", "limits": ["It never merges into the default branch.", "It never answers for a person.", "It never approves a PRD."]},
    {"role": "architect", "name": "Architect", "skills": ["plan", "tech-review"], "agent": "claude", "model": "opus", "limits": ["It never merges into the default branch.", "It never answers for a person.", "It never approves a plan."]},
    {"role": "designer", "name": "Designer", "skills": ["visual-fix", "pixel-perfect", "think-big"], "agent": "claude", "model": "opus", "limits": ["It never merges into the default branch.", "It never answers for a person.", "It never locks a screen: a person does."]}
  ]$json$::jsonb
$$;

-- ── The refusals that name the roles ──────────────────────────────────────────────

-- create_virtual_fleet() of 20270122090000_virtual_fleets.sql, its unknown-role refusal naming the six roles.
create or replace function public.create_virtual_fleet(
  p_workspace uuid, p_name text, p_mascot text, p_roles text[]
) returns public.teams
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_label text := btrim(coalesce(p_name, ''));
  v_mascot text := nullif(btrim(coalesce(p_mascot, '')), '');
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
  return made;
end;
$$;

-- add_virtual_hero() of 20270122095000_virtual_hero_edit.sql, its unknown-role refusal naming the six roles.
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
    raise exception 'Role: one of engineer, qa, reviewer, pm, architect or designer.' using errcode = '22023', hint = 'role';
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

-- ── Every hero already made lists its role's skills ───────────────────────────────

-- Only its skills: its name, agent, model, limits and position stay as its owner left them.
update public.virtual_heroes h
   set skills = array(select s.value from jsonb_array_elements_text(d.value -> 'skills') with ordinality as s (value, n) order by s.n),
       updated_at = now()
  from jsonb_array_elements(public.virtual_hero_roles()) as d (value)
 where d.value ->> 'role' = h.role
   and h.skills is distinct from array(select s.value from jsonb_array_elements_text(d.value -> 'skills') with ordinality as s (value, n) order by s.n);
