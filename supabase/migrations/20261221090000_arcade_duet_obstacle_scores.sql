-- OMNI DUET's board starts over (PRD #2318, first written as PRD 2159), as Martin asked when its scoring moved to one point per obstacle.
--
-- DUET used to score 10 a wave (20 in endless mode); it now scores 1 an obstacle passed (2 in endless mode),
-- so the bests set before are not on the new scale. Every row of `arcade_scores` on the board `duet` moves,
-- in every workspace, to the retired board `duet-waves`, which no cabinet reads; nothing is deleted, and
-- nothing else changes: no other game, no other table. `arcade_scores` is not the game's ledger
-- (N-PRODUCT-16), which this leaves as it is. `submit_score()` and the table's shape do not change, so
-- supabase/database.types.ts stays as it is.
--
-- To undo it, after reverting the app, a new migration puts the old board back and keeps each player's
-- better best when they also played under the new rule (the spec's Risks):
--
--   insert into public.arcade_scores (workspace_id, user_id, game, best, at)
--   select workspace_id, user_id, 'duet', best, at from public.arcade_scores where game = 'duet-waves'
--   on conflict on constraint arcade_scores_pkey do update
--     set best = greatest(arcade_scores.best, excluded.best),
--         at = case when excluded.best > arcade_scores.best then excluded.at else arcade_scores.at end;
--   delete from public.arcade_scores where game = 'duet-waves';

update public.arcade_scores set game = 'duet-waves' where game = 'duet';
