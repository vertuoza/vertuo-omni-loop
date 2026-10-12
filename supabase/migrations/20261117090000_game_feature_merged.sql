-- A merged feature PR pays the people who landed it.
--
-- public.ledger_events.type takes two more values: FEATURE_MERGED (who merged a region's feature PR
-- into its default branch) and FEATURE_REVIEWED (each person who approved it, its author aside). The
-- projector writes them from game:project's GitHub read, dated at the merge, and the economy pays
-- RULEBOOK.featureMerged and RULEBOOK.featureReviewed. Merges since a workspace's game_since are
-- backfilled on the first poll after this lands.
--
-- Rollback: set both numbers to 0 in game/rulebook.ts. The types stay allowed: the ledger is
-- append-only, so a row once written stays, paying nothing.

alter table public.ledger_events drop constraint ledger_events_type_check;
alter table public.ledger_events add constraint ledger_events_type_check check (type in (
  'PLANET_CHARTED', 'REGION_SURVEYED', 'PLANET_LOCKED', 'PLANET_UNLOCKED',
  'ZONE_OPENED', 'ZONE_CLAIMED', 'ZONE_SECURED', 'ZONE_REVERTED',
  'WOUND_OPENED', 'WOUND_CLOSED', 'DISTRESS', 'RESCUE',
  'PLANET_READY', 'PLANET_TERRAFORMED', 'PLANET_LOST', 'PLANET_DECOMMISSIONED',
  'QUESTION_ANSWERED', 'FEATURE_MERGED', 'FEATURE_REVIEWED'));
