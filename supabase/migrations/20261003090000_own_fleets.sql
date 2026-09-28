-- Your own fleets, or none (PRD 400, docs: .omni-loop/delivery/inbox/0400-own-fleets/spec.md).
-- A workspace's owner, and only its owner, writes its fleets: create_fleet(), update_fleet(),
-- retire_fleet() and restore_fleet(), each security definer and run as the signed-in person. This is
-- the first reader of workspace_members.role, through is_owner(). Nobody signed in writes public.teams
-- directly, as before. A fleet's name (its key, which ledger events name) is derived from its label
-- once and never changes; nothing deletes a fleet; at most 12 are active per workspace. A player may
-- have no fleet (players.team was already nullable, and players_guard() accepts null).
--
-- Every statement can run twice (create or replace, one update): supabase/checks/fleets.sql re-applies
-- this file to prove the Vertuoza owner step once that member exists.
--
-- Proven by supabase/checks/fleets.sql.
-- Rollback: a follow-up migration drops the four fleet functions, fleet_mascots() and is_owner().
-- Fleets created meanwhile stay, because ledger events may name them.

-- ── Who owns a workspace ─────────────────────────────────────────────────────────

-- True when the caller is an owner of the workspace.
create or replace function public.is_owner(workspace uuid) returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
     where m.workspace_id = workspace and m.user_id = auth.uid() and m.role = 'owner'
  )
$$;

-- ── What a fleet may look like ───────────────────────────────────────────────────

-- The mascot keys an owner may pick: the fleet mascots of @omni/design's sprite set (sprites.mjs ›
-- SPRITE_DEFS). A mascot added there is added here by a migration.
create or replace function public.fleet_mascots() returns text[]
language sql immutable
set search_path = ''
as $$
  select array['beaver', 'octopod', 'picsou', 'cia', 'pirate', 'invincible']
$$;

-- Refuses the caller unless they own the workspace.
create or replace function public.fleet_owner_only(p_workspace uuid) returns void
language plpgsql stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or p_workspace is null or not public.is_owner(p_workspace) then
    raise exception 'Only the workspace''s owner can change its fleets.' using errcode = '42501';
  end if;
end;
$$;

-- Checks a fleet's look, and answers it cleaned: the label and motto trimmed, the colour lowercased,
-- an empty mascot as none. Each refusal names its field first, and carries it as the hint.
create or replace function public.fleet_look(
  p_label text, p_color text, p_motto text, p_mascot text,
  out label text, out color text, out motto text, out mascot text
)
language plpgsql immutable
set search_path = ''
as $$
begin
  label := btrim(coalesce(p_label, ''));
  color := lower(btrim(coalesce(p_color, '')));
  motto := btrim(coalesce(p_motto, ''));
  mascot := nullif(btrim(coalesce(p_mascot, '')), '');
  if char_length(label) not between 1 and 12 then
    raise exception 'Label: 1 to 12 characters.' using errcode = '22023', hint = 'label';
  end if;
  if color !~ '^#[0-9a-f]{6}$' then
    raise exception 'Colour: a hex colour, #rrggbb.' using errcode = '22023', hint = 'color';
  end if;
  if char_length(motto) > 60 then
    raise exception 'Motto: at most 60 characters.' using errcode = '22023', hint = 'motto';
  end if;
  if mascot is not null and not (mascot = any (public.fleet_mascots())) then
    raise exception 'Mascot: one of %, or none.', array_to_string(public.fleet_mascots(), ', ')
      using errcode = '22023', hint = 'mascot';
  end if;
end;
$$;

-- Refuses one more active fleet when the workspace already has 12.
create or replace function public.fleet_room(p_workspace uuid) returns void
language plpgsql stable
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.teams t where t.workspace_id = p_workspace and t.retired_at is null) >= 12 then
    raise exception 'Fleets: at most 12 active. Retire one first.' using errcode = '22023', hint = 'fleets';
  end if;
end;
$$;

-- ── The owner's four fleet functions ─────────────────────────────────────────────

-- A new fleet. Its name is the label lowercased, every run of other characters a dash ("C.I.A." →
-- "c-i-a"), "fleet" when nothing is left, and "-2", "-3"… when the workspace already has that name,
-- retired fleets included.
create or replace function public.create_fleet(
  p_workspace uuid, p_label text, p_color text, p_motto text default '', p_mascot text default null
) returns public.teams
language plpgsql
security definer
set search_path = ''
as $$
declare
  look record;
  base text;
  candidate text;
  n integer := 1;
  made public.teams;
begin
  perform public.fleet_owner_only(p_workspace);
  select * into look from public.fleet_look(p_label, p_color, p_motto, p_mascot);
  -- Two owners' clicks never race past the cap or to one name.
  perform pg_advisory_xact_lock(hashtext('fleets:' || p_workspace::text));
  perform public.fleet_room(p_workspace);

  base := coalesce(nullif(btrim(regexp_replace(lower(look.label), '[^a-z0-9]+', '-', 'g'), '-'), ''), 'fleet');
  candidate := base;
  while exists (select 1 from public.teams t where t.workspace_id = p_workspace and t.name = candidate) loop
    n := n + 1;
    candidate := base || '-' || n;
  end loop;

  insert into public.teams (workspace_id, name, label, color, motto, mascot, sort)
  values (p_workspace, candidate, look.label, look.color, look.motto, look.mascot,
          coalesce((select max(t.sort) from public.teams t where t.workspace_id = p_workspace), 0) + 10)
  returning * into made;
  return made;
end;
$$;

-- A fleet's new look: its label, colour, motto and mascot, all four. Its name never changes.
create or replace function public.update_fleet(
  p_workspace uuid, p_name text, p_label text, p_color text, p_motto text default '', p_mascot text default null
) returns public.teams
language plpgsql
security definer
set search_path = ''
as $$
declare
  look record;
  changed public.teams;
begin
  perform public.fleet_owner_only(p_workspace);
  select * into look from public.fleet_look(p_label, p_color, p_motto, p_mascot);
  update public.teams t
     set label = look.label, color = look.color, motto = look.motto, mascot = look.mascot
   where t.workspace_id = p_workspace and t.name = p_name
  returning * into changed;
  if not found then
    raise exception 'Fleet: no fleet % in this workspace.', p_name using errcode = 'P0002', hint = 'name';
  end if;
  return changed;
end;
$$;

-- Retires a fleet: it leaves the select screen, its history keeps its look. Retiring a retired fleet
-- changes nothing.
create or replace function public.retire_fleet(p_workspace uuid, p_name text) returns public.teams
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed public.teams;
begin
  perform public.fleet_owner_only(p_workspace);
  update public.teams t
     set retired_at = coalesce(t.retired_at, now())
   where t.workspace_id = p_workspace and t.name = p_name
  returning * into changed;
  if not found then
    raise exception 'Fleet: no fleet % in this workspace.', p_name using errcode = 'P0002', hint = 'name';
  end if;
  return changed;
end;
$$;

-- Brings a retired fleet back, when the workspace has room for one more active fleet.
create or replace function public.restore_fleet(p_workspace uuid, p_name text) returns public.teams
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed public.teams;
begin
  perform public.fleet_owner_only(p_workspace);
  perform pg_advisory_xact_lock(hashtext('fleets:' || p_workspace::text));
  select * into changed from public.teams t where t.workspace_id = p_workspace and t.name = p_name;
  if not found then
    raise exception 'Fleet: no fleet % in this workspace.', p_name using errcode = 'P0002', hint = 'name';
  end if;
  if changed.retired_at is null then
    return changed;
  end if;
  perform public.fleet_room(p_workspace);
  update public.teams t set retired_at = null
   where t.workspace_id = p_workspace and t.name = p_name
  returning * into changed;
  return changed;
end;
$$;

-- ── Who may call what ────────────────────────────────────────────────────────────

-- Signed out: nothing. Signed in: the four functions, which refuse all but the owner. The helpers
-- behind them are theirs alone; is_owner() is also the app's to ask.
revoke execute on function public.is_owner(uuid) from public, anon;
grant execute on function public.is_owner(uuid) to authenticated, service_role;
revoke execute on function public.fleet_mascots() from public;
grant execute on function public.fleet_mascots() to anon, authenticated, service_role;
revoke execute on function public.fleet_owner_only(uuid) from public, anon, authenticated;
revoke execute on function public.fleet_look(text, text, text, text) from public, anon, authenticated;
revoke execute on function public.fleet_room(uuid) from public, anon, authenticated;
revoke execute on function public.create_fleet(uuid, text, text, text, text) from public, anon;
grant execute on function public.create_fleet(uuid, text, text, text, text) to authenticated;
revoke execute on function public.update_fleet(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.update_fleet(uuid, text, text, text, text, text) to authenticated;
revoke execute on function public.retire_fleet(uuid, text) from public, anon;
grant execute on function public.retire_fleet(uuid, text) to authenticated;
revoke execute on function public.restore_fleet(uuid, text) from public, anon;
grant execute on function public.restore_fleet(uuid, text) to authenticated;

comment on table public.teams is
  'The fleets of a workspace, none or up to 12 active. Its owner adds, restyles, retires and restores them through create_fleet(), update_fleet(), retire_fleet() and restore_fleet(); otherwise only the service role or a migration writes them. The name is set once and never changes, and nothing deletes a fleet: ledger events name it forever.';
comment on column public.teams.mascot is
  'A mascot key of fleet_mascots(), from @omni/design''s sprite set. Null: the fleet is drawn as a hero in its own colour.';
comment on table public.players is
  'One row per player and workspace: a member who linked their GitHub account. Arcade name, fleet (null: a solo player, whose points are their own), hero, and the GitHub login their points are earned under.';
comment on column public.players.team is
  'The player''s fleet, a name of public.teams. Null: they play solo.';

-- ── Vertuoza's owner ─────────────────────────────────────────────────────────────

-- The member whose linked GitHub login is pierrederval owns the vertuoza workspace, when that account
-- is a member. Vertuoza's fleets stay its own.
update public.workspace_members m
   set role = 'owner'
  from public.workspaces w
 where w.id = m.workspace_id and w.slug = 'vertuoza' and m.role <> 'owner'
   and exists (
     select 1 from auth.identities i
      where i.user_id = m.user_id and i.provider = 'github'
        and lower(coalesce(i.identity_data ->> 'user_name', i.identity_data ->> 'preferred_username')) = 'pierrederval'
   );
