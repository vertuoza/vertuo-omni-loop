-- COMET RING's best times start over with FROST EIGHT (PRD #1923), as the person asked during the build.
--
-- COMET RING changed since its board was last emptied (PRD #1698): it now drives in curves, through a
-- vaulted tunnel in a bend (#1840), so the times set before stay out of reach. The rows of
-- `arcade_scores` on the board `kart`, COMET RING's, are deleted, in every workspace, and nothing else:
-- not `kart-frost-eight`, no other game, no other table. `arcade_scores` is not the game's ledger
-- (N-PRODUCT-16), which this leaves as it is. The weekly export (`pnpm game:export`) keeps them. A revert
-- of this migration does not bring them back. `submit_score()` and the table's shape do not change, so
-- supabase/database.types.ts stays as it is.

delete from public.arcade_scores where game = 'kart';
