-- A pull request merged into a tracked repository's default branch pays its author and its reviewers
-- (PRD 1975).
--
-- 1. public.ledger_events.type takes two more values: PR_MERGED (the author of a pull request merged into
-- a tracked repository's default branch) and PR_REVIEWED (each of its reviewers: its approvers and its
-- merger, its author aside). The projector writes them from game:project's GitHub read, dated at the
-- merge, on no planet (planet 0), and the economy pays RULEBOOK.prMerged and RULEBOOK.prReviewed by the
-- pull request's kind. Merges since a workspace's game_since are backfilled on the first poll after
-- this lands.
-- 2. public.ledger_events.planet takes 0 for both, as for a QUESTION_ANSWERED: neither belongs to a
--    planet, so no crew, terraform or loss reads them.
--
-- Rollback: set both tables to 0 in game/rulebook.ts. The types stay allowed: the ledger is
-- append-only, so a row once written stays, paying nothing.

alter table public.ledger_events drop constraint ledger_events_type_check;
alter table public.ledger_events add constraint ledger_events_type_check check (type in (
  'PLANET_CHARTED', 'REGION_SURVEYED', 'PLANET_LOCKED', 'PLANET_UNLOCKED',
  'ZONE_OPENED', 'ZONE_CLAIMED', 'ZONE_SECURED', 'ZONE_REVERTED',
  'WOUND_OPENED', 'WOUND_CLOSED', 'DISTRESS', 'RESCUE',
  'PLANET_READY', 'PLANET_TERRAFORMED', 'PLANET_LOST', 'PLANET_DECOMMISSIONED',
  'QUESTION_ANSWERED', 'FEATURE_MERGED', 'FEATURE_REVIEWED', 'PR_MERGED', 'PR_REVIEWED'));

alter table public.ledger_events drop constraint ledger_events_planet_check;
alter table public.ledger_events add constraint ledger_events_planet_check
  check (planet > 0 or (planet = 0 and type in ('QUESTION_ANSWERED', 'PR_MERGED', 'PR_REVIEWED')));
