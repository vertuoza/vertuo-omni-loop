-- Virtual Fleets and their Virtual Heroes (PRD 2842 s1, docs: .omni-loop/delivery/inbox/2842-missions/spec.md).
-- A Virtual Fleet is a fleet like the workspace's others (a row of public.teams: a name, a label, a
-- colour, a mascot), of kind `virtual`: its members are Virtual Heroes, agents one per role, never
-- players. Any member of the workspace creates one, through create_virtual_fleet(), security definer
-- and run as the signed-in person; a players' fleet stays its owner's (create_fleet() is unchanged).
-- A member reads a virtual fleet's heroes; nobody signed in writes them directly. No player flies in a
-- virtual fleet (players_guard() refuses it), so it earns nothing on the ledger, and the arcade's
-- select screen never offers it.
--
-- create_virtual_fleet() takes the fleet's name, its mascot and the roles left on. Its key is its
-- label lowercased, each run of other characters a dash (BR-PRODUCT-47, as create_fleet() derives it);
-- a key the workspace already holds, retired fleets included, is refused as `Name taken: choose
-- another`, never numbered. Its colour is the first of virtual_fleet_colors() no active fleet of the
-- workspace wears (the first again when all are worn); its mascot one of fleet_mascots()
-- (BR-PRODUCT-46). Each hero copies its role's defaults from virtual_hero_roles(), the list
-- kit/lib/virtual-fleet/roles.ts holds (apps/galaxy/src/virtual-fleets/roles-sql.test.ts holds the two
-- equal); the swatches are the Settings › Fleets form's (apps/galaxy/src/fleets/model.ts › SWATCHES).
--
-- Every statement can run twice except the column and the table, which a re-run skips.
-- Proven by supabase/checks/virtual_fleets.sql.
-- Rollback: a follow-up migration drops create_virtual_fleet(), virtual_hero_roles(),
-- virtual_fleet_colors() and public.virtual_heroes, restores players_guard() from
-- 20260926120000_workspaces.sql, and drops public.teams.kind once no virtual fleet is left (a virtual
-- fleet then reads as a players' fleet with no player).

-- ── A fleet's kind ────────────────────────────────────────────────────────────────

alter table public.teams
  add column if not exists kind text not null default 'crew'
  constraint teams_kind check (kind in ('crew', 'virtual'));

comment on column public.teams.kind is
  '`crew`: a players'' fleet, which its owner makes in Settings › Fleets. `virtual`: a Virtual Fleet of Virtual Heroes (public.virtual_heroes), which any member makes from the Fleet section; no player flies in it.';

-- ── Its heroes ────────────────────────────────────────────────────────────────────

create table if not exists public.virtual_heroes (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  fleet        text not null,
  name         text not null constraint virtual_heroes_name_length check (char_length(name) between 1 and 40),
  role         text not null constraint virtual_heroes_role check (role in ('engineer', 'qa', 'reviewer', 'pm', 'architect')),
  skills       text[] not null default '{}',
  agent        text not null constraint virtual_heroes_agent_length check (char_length(agent) between 1 and 40),
  model        text not null constraint virtual_heroes_model_length check (char_length(model) between 1 and 60),
  limits       text[] not null default '{}',
  position     smallint not null constraint virtual_heroes_position check (position >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  foreign key (workspace_id, fleet) references public.teams (workspace_id, name) on update cascade on delete cascade,
  constraint virtual_heroes_position_once unique (workspace_id, fleet, position)
);

comment on table public.virtual_heroes is
  'The Virtual Heroes of a Virtual Fleet (public.teams of kind virtual): agents, one per role, each with its role''s skills, a preferred agent and model (recorded, not routed) and its limits in sentences. Never a player: none earns on the ledger. A member of the workspace reads them; create_virtual_fleet() and the service role write them.';

alter table public.virtual_heroes enable row level security;

drop policy if exists "a member reads their workspace's virtual heroes" on public.virtual_heroes;
create policy "a member reads their workspace's virtual heroes" on public.virtual_heroes
  for select to authenticated using (workspace_id in (select public.my_workspaces()));

revoke insert, update, delete, truncate on public.virtual_heroes from anon, authenticated;
grant select on public.virtual_heroes to authenticated;
grant all on public.virtual_heroes to service_role;

-- ── What a new virtual fleet starts with ─────────────────────────────────────────

-- The roles a new hero may take, in the drawer's order, with the defaults it starts with: the list of
-- kit/lib/virtual-fleet/roles.ts › ROLES, as one JSON array between the $json$ markers.
create or replace function public.virtual_hero_roles() returns jsonb
language sql immutable
set search_path = ''
as $$
  select $json$[
    {"role": "engineer", "name": "Engineer", "skills": ["yolo", "yolo-fix", "wave", "do-work", "pr-care", "bug-fix"], "agent": "claude", "model": "sonnet", "limits": ["It never merges into the default branch.", "It never answers for a person.", "It waits for a person wherever one is needed."]},
    {"role": "qa", "name": "QA", "skills": ["prove", "bug-fix"], "agent": "claude", "model": "sonnet", "limits": ["It never merges into the default branch.", "It never answers for a person.", "It reports what it saw; a person decides."]},
    {"role": "reviewer", "name": "Reviewer", "skills": [], "agent": "claude", "model": "opus", "limits": ["It never merges into the default branch.", "It never answers for a person.", "It has no skill to run yet."]},
    {"role": "pm", "name": "PM", "skills": ["pitch", "plan"], "agent": "claude", "model": "opus", "limits": ["It never merges into the default branch.", "It never answers for a person.", "It never approves a PRD."]},
    {"role": "architect", "name": "Architect", "skills": ["plan"], "agent": "claude", "model": "opus", "limits": ["It never merges into the default branch.", "It never answers for a person.", "It never approves a plan."]}
  ]$json$::jsonb
$$;

-- The colours a new virtual fleet is given, in order: the Settings › Fleets form's swatches.
create or replace function public.virtual_fleet_colors() returns text[]
language sql immutable
set search_path = ''
as $$
  select array['#d08a4a', '#b07cff', '#ffd84a', '#9aa3c8', '#2fc6a4', '#4fb0ff', '#ff6b8a', '#8bd450']
$$;

-- ── Creating one ──────────────────────────────────────────────────────────────────

-- A new virtual fleet and its heroes, for any member of the workspace. Each refusal names its field
-- first and carries it as the hint (ADR-0050): `name`, `mascot`, `heroes`, or `fleets` for the cap of 12
-- active fleets. Answers the fleet's public.teams row.
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
    raise exception 'Heroes: each one of engineer, qa, reviewer, pm or architect.' using errcode = '22023', hint = 'heroes';
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

-- ── No player in a virtual fleet ──────────────────────────────────────────────────

-- The players' guard of 20260926120000_workspaces.sql, refusing one more fleet: a virtual one, whose
-- members are heroes, never players.
create or replace function public.players_guard() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.team is distinct from old.team then
    if new.team is not null and exists (
      select 1 from public.teams t
       where t.workspace_id = new.workspace_id and t.name = new.team and t.retired_at is not null
    ) then
      raise exception 'The fleet % is retired. Choose another one.', new.team using errcode = 'check_violation';
    end if;
    if new.team is not null and exists (
      select 1 from public.teams t
       where t.workspace_id = new.workspace_id and t.name = new.team and t.kind = 'virtual'
    ) then
      raise exception 'The fleet % is a virtual fleet: its heroes are agents. Choose another one.', new.team using errcode = 'check_violation';
    end if;
    new.team_since := case when new.team is null then null else now() end;
  else
    new.team_since := old.team_since;
  end if;
  if tg_op = 'INSERT' then
    new.created_at := now();
    if new.user_id = auth.uid() then
      select g.github_id, g.github_login into new.github_id, new.github_login from public.my_github() g;
    end if;
  else
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- ── Who may call what ─────────────────────────────────────────────────────────────

revoke execute on function public.virtual_hero_roles() from public;
grant execute on function public.virtual_hero_roles() to authenticated, service_role;
revoke execute on function public.virtual_fleet_colors() from public;
grant execute on function public.virtual_fleet_colors() to authenticated, service_role;
revoke execute on function public.create_virtual_fleet(uuid, text, text, text[]) from public, anon;
grant execute on function public.create_virtual_fleet(uuid, text, text, text[]) to authenticated;
