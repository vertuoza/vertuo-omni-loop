-- Five more fleet mascots (PRD 517, docs: .omni-loop/delivery/inbox/0517-more-mascots/spec.md).
-- An owner picks a fleet's mascot from eleven keys, not six: atom-eve, shark, turtle, allen and robot
-- join the library, after the six it had, in @omni/design's order (sprites.mjs › MASCOTS). fleet_look()
-- already reads fleet_mascots(), so create_fleet() and update_fleet() accept the new keys with no other
-- change, and dragon, entropy, omni and the fleet-only names stay refused. packages/design's
-- mascots.test.mjs fails when this list and MASCOTS differ, in content or in order.
--
-- Proven by supabase/checks/fleets.sql.
-- Rollback: a follow-up migration restores the six keys of 20261003090000_own_fleets.sql. A fleet that
-- picked a new mascot meanwhile keeps its key; with the sprite gone it is drawn as a hero in its colour.

-- The mascot keys an owner may pick: the fleet mascots of @omni/design's sprite set (sprites.mjs ›
-- MASCOTS), in its order. A mascot added there is added here by a migration.
create or replace function public.fleet_mascots() returns text[]
language sql immutable
set search_path = ''
as $$
  select array['beaver', 'octopod', 'picsou', 'cia', 'pirate', 'invincible', 'atom-eve', 'shark', 'turtle', 'allen', 'robot']
$$;
