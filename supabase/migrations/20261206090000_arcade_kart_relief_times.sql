-- OMNI KART's best times start over (PRD #1698): the circuit now has hills and new boxes.
--
-- A lap with hills takes longer than a flat one, so the best times set on the flat circuit would stay
-- out of reach. The kart's rows of `arcade_scores` are deleted, in every workspace, and nothing else:
-- no other game, no other table. The weekly export (`pnpm game:export`) keeps them. A revert of this
-- migration does not bring them back. `submit_score()` and the table's shape do not change, so
-- supabase/database.types.ts stays as it is.

delete from public.arcade_scores where game = 'kart';
