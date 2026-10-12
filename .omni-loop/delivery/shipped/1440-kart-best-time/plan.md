# Plan: OMNI KART keeps the best race time, not points

PRD #1440, specified in `spec.md` beside this plan. The feature branch `feat/kart-best-time` merges into
`main` through one feature PR (`Closes #1440`); each slice is a sub-PR from `feat/kart-best-time--<slice>`
into the feature branch (`Part of #1440`). One landing: the migration and the code that reads it ship
in the same merge, and the spec accepts the deployment window between them (**Risks**).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | `submit_score()` keeps the lowest time for `kart` and the highest score for every other game, the kart's point scores are reset, and each game of the registry declares its measure, read through `measure.ts`, with the guard test tying the SQL list to the registry | `supabase/migrations/` `supabase/checks/access.sql` `apps/galaxy/src/arcade/games/index.ts` `apps/galaxy/src/arcade/games/room.test.ts` `apps/galaxy/src/arcade/measure` `game/README.md` | — | 1 |
| s2 | the kart's finish carries the player's race time in tenths, `KartGame.step` answers it, the RESULTS screen shows `TIME 1:42.3`, and the place points and the 150-second par are gone | `apps/galaxy/src/arcade/kart/` `apps/galaxy/src/arcade/scenes/kart.` | — | 1 |
| s3 | the shared readers follow the measure: `loadScores` sorts a time fastest first, `withBest`, `isNewBest` and `saved` keep the better in the game's direction, the kart's end line reads `SAVING TIME…` / `TIME NOT SAVED` / `YOUR BEST 1:42.3`, the cabinet's CREW TOP 5 shows times, and the demo account and the fake Supabase keep the lowest time | `apps/galaxy/src/data/scores.` `apps/galaxy/src/data/galaxy.fake.ts` `apps/galaxy/src/arcade/scenes/invaders-score.` `apps/galaxy/src/arcade/scenes/games.` `apps/galaxy/src/arcade/scenes/platformer.tsx` `apps/galaxy/src/arcade/scenes/kart.tsx` `apps/galaxy/src/arcade/scenes/kart.test.ts` `apps/galaxy/src/arcade/account-demo.` `apps/galaxy/src/arcade/types.ts` `apps/galaxy/src/arcade/ArcadeApp.tsx` `apps/galaxy/src/play-dock/send.` `apps/galaxy/README.md` | s1, s2 | 2 |

**Shared ground.** `apps/galaxy/src/arcade/scenes/kart.tsx` and `apps/galaxy/src/arcade/scenes/kart.test.ts`
are declared by s2 (through its `apps/galaxy/src/arcade/scenes/kart.` prefix: the results line and the
finish) and by s3 (the kart's call to `sendLine` with its measure, and the pins of its send lines). s2
builds in wave 1 and s3 in wave 2, after s2 merged, so s3 edits those files on top of s2's work.
`apps/galaxy/README.md` is s3's alone: it documents the contract (s1), the kart's time (s2) and the
readers (s3) once all three are true. No other prefix is declared twice.

## Per slice: done when

### s1: the contract and the measure

- A migration stamped after the latest one in `supabase/migrations/` replaces `submit_score(workspace, game, score)`
  with the same signature and return: for every game in its declared list of lowest-wins games
  (`kart` alone) it keeps `least(stored, sent)`, for every other game `greatest(stored, sent)`, and
  `at` moves only when the value improves in the game's direction. Its checks (a player of the
  workspace, 0 to 9,999,999, the game unlocked) are unchanged, every grant is stated again (revoked,
  then granted), and its header says why, naming PRD #1440.
- The same migration deletes every `arcade_scores` row whose game is `kart`.
- `supabase/checks/access.sql` proves for `kart`: 1200 stored, 1500 returns 1200, 900 returns 900,
  and `at` moves only on 900; ENTROPY INVADERS' existing pins (the higher kept) pass unchanged.
- `supabase/database.types.ts` is unchanged (`node scripts/supabase-types.ts --check` passes).
- `Game` has `measure: 'points' | 'time'`: ENTROPY INVADERS and SUPER OMNI WORLD `points`, OMNI KART
  `time`; `games/room.test.ts` pins the rows with their measure.
- `apps/galaxy/src/arcade/measure.ts` (pure) answers whether one value is better than another, the
  better of two, the order a table sorts in, the text of a best (`9 210` for points, `1:42.3` for a
  time, through the existing `raceTime` and digit grouping) and a game's measure from its id
  (`points` for an id the registry does not hold); its unit tests cover each, for both measures.
- The guard test reads the migration: it fails when a `time` game of `GAMES` is missing from the SQL
  list, when that list names a game the registry does not mark `time`, or when the migration does
  not delete the `kart` rows; a fixture with one game missing on either side fails.
- `game/README.md` says `submit_score()` keeps the better value in each game's direction.

### s2: the kart sends its time

- `scoreOf`, `RULES.placePoints` and `PAR_SECONDS` are gone, with their pins.
- `KartResults` has no `score`; the finish event is `{ kind: 'finish'; tenths: number }`, given once
  when the player crosses the line at the end of the last lap; `cuesOf` of it is still `[]`.
- `KartGame.step` answers the player's race time in tenths on the step that finishes the race, else
  null (`kart/art.ts`), so `ArcadeApp` sends the time under `kart` unchanged.
- The RESULTS screen keeps its table of six places and times, and the line under it reads
  `TIME 1:42.3` (`raceTime` of the player's tenths) where it read `SCORE 1500`.
- Quitting from the pause still gives no finish and sends nothing; `kart/race.test.ts` and
  `scenes/kart.test.ts` prove both.

### s3: the shared readers follow the measure

- `loadScores` sorts `best` ascending for a `time` game and descending for a `points` game, the
  earlier of two equal ones first either way; `data/scores.test.ts` proves the kart's top five
  fastest first, ENTROPY INVADERS' unchanged.
- The fake Supabase (`galaxy.fake.ts`) keeps the lower time for `kart` and the higher score for
  `invaders`.
- `isNewBest` and `saved` (`scenes/invaders-score.ts`) take the measure: for a time, the first is a
  NEW BEST, then only a faster one; `withBest` keeps the table sorted in the game's direction and
  keeps five, a slower time changing nothing; `submitSend` reads the measure from its game.
- `sendLine` takes the measure: the kart reads `SAVING TIME…`, `TIME NOT SAVED`, `NEW BEST` or
  `YOUR BEST 1:42.3`; SUPER OMNI WORLD's lines and every existing pin of ENTROPY INVADERS and SUPER
  OMNI WORLD pass word for word. The play dock (ENTROPY INVADERS and SUPER OMNI WORLD only) sends
  as before.
- The cabinet's CREW TOP 5 (`TopFive` in `scenes/games.tsx`) shows each best in its game's text:
  `1:42.3` on OMNI KART's cabinet, digits on the others; `scenes/games.test.ts` proves both.
- The demo account keeps the better of the guest's stored best and the new one in the game's
  direction, the lowest kart time; `account-demo.test.ts` proves it, and its existing pins pass.
- `Account.submitScore` (`types.ts`) is documented as answering the better of the two for that game.
- `apps/galaxy/README.md` says the kart keeps the best race time (the lowest, in tenths, sent once at
  the finish, with the kart's own send lines), that `submit_score()` keeps the better value in each
  game's direction, and that the crew tables sort in that direction.
