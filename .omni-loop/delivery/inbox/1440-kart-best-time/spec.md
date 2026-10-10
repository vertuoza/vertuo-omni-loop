---
prd: 1440
title: OMNI KART keeps the best race time, not points
blocked-by: none
spec: file
---

# OMNI KART keeps the best race time, not points

**Date:** 2026-10-10 · **PRD:** #1440
**Touches:**
- `supabase/migrations/<stamp>_arcade_kart_times.sql` (new: `submit_score()` with a direction per
  game, and the kart's point scores reset), and `supabase/checks/access.sql` (its proof)
- `apps/galaxy/src/arcade/games/index.ts` (each game's `measure`) and a new
  `apps/galaxy/src/arcade/measure.ts` (the direction and the format, in one place)
- `apps/galaxy/src/data/scores.ts`, `apps/galaxy/src/data/galaxy.fake.ts` (the table read in the
  game's direction; the fake keeps the better)
- `apps/galaxy/src/arcade/scenes/invaders-score.ts`, `scenes/games.tsx`, `account-demo.ts`,
  `types.ts` (the shared score lines, the cabinet's CREW TOP 5, the demo's best)
- `apps/galaxy/src/arcade/kart/race.ts`, `kart/rules.ts`, `kart/track.ts`, `kart/art.ts`,
  `scenes/kart.ts`, `scenes/kart.tsx` (the finish carries the time; the points go)
- `apps/galaxy/README.md`, `game/README.md` (the docs that say a score keeps the higher)

## Problem

OMNI KART ends a race with a point score: 1000, 700, 500, 350, 200 or 100 for the place, plus a
point per tenth of a second under 150 seconds. A racer does not think in points: they want to know
how fast they went, and whether they beat their own time. The results screen shows `SCORE 1500`,
and the kart cabinet's CREW TOP 5 ranks those points, a number nobody can read as a lap of COMET
RING.

The score table cannot simply hold a time either. `arcade_scores` and `submit_score()` keep the
highest value for every game: the function stores `greatest(stored, sent)`, and the browser sorts,
merges and names a NEW BEST the same way in eight places. A time sent as it is would keep the
player's slowest race.

## Solution

The kart keeps each player's **best race time**, the time of the whole race (its three laps), in
tenths of a second, and the lowest wins. ENTROPY INVADERS and SUPER OMNI WORLD keep their points,
and the highest still wins.

### The contract

One migration, stamped after the latest one, its header saying why and naming PRD #1440:

- **`submit_score(workspace, game, score)` is replaced, with the same signature and return.** Its
  checks stay as they are: a player of the workspace, a whole number from 0 to 9,999,999, the game
  unlocked. What changes is the direction: the function declares the list of games where the lowest
  wins, `kart` alone, and for those keeps `least(stored, sent)`, for every other game
  `greatest(stored, sent)` as today. `at` moves only when the value improves in the game's
  direction. The signature does not change, so `supabase/database.types.ts` stays as it is.
- **The kart's point scores are reset:** the same migration deletes every `arcade_scores` row whose
  game is `kart`. Points cannot become times (one value comes from several places and times), and
  the weekly exports already made keep them.
- **Every grant is stated again,** revoked first, then granted, as the repository's migrations do.
- **No new index.** A game's table in a workspace holds one row per crew member; the kart's ascending
  sort runs on those few rows, and `arcade_scores_top_idx` still serves the filter by workspace and
  game.
- **The unit:** for `kart`, `best` holds tenths of a second (`1023` is 1:42.3). The 9,999,999 cap is
  about 277 hours, so it holds.

The weekly export (`game/cli/export.ts`) does not change: it is a backup, the order of its rows
changes nothing, and the tenths read as they are.

### The registry and `measure.ts`

`Game` in `games/index.ts` gains `measure: 'points' | 'time'`: `points`, the highest wins, shown in
digits grouped by three (`9 210`); `time`, the lowest wins, shown as `raceTime` shows it (`1:42.3`).
ENTROPY INVADERS and SUPER OMNI WORLD are `points`, OMNI KART is `time`.

A new pure module, `apps/galaxy/src/arcade/measure.ts`, holds the direction and the format, and
nothing else: whether one value is better than another, the better of two, the order a table sorts
in, the text of a best, and a game's measure from its id (`points` for an id the registry does not
hold). Every shared reader below goes through it, so no reader writes the direction itself.

### The shared readers follow the measure

- **`loadScores`** (`data/scores.ts`) sorts `best` ascending for a `time` game, descending for a
  `points` game, the earlier of two equal ones first either way.
- **`isNewBest` and `withBest`** (`scenes/invaders-score.ts`): for a `time` game, the first time is a
  NEW BEST, then only a faster one is; a slower one changes nothing in the table, which stays sorted
  fastest first and keeps five.
- **The end screen's line** (`sendLine`): the kart reads `SAVING TIME…`, `TIME NOT SAVED`, `NEW BEST`
  or `YOUR BEST 1:42.3`. ENTROPY INVADERS and SUPER OMNI WORLD keep their lines word for word.
- **The cabinet's CREW TOP 5** (`TopFive` in `scenes/games.tsx`) shows each line's best in its game's
  format: `1:42.3` on OMNI KART's cabinet. Its title does not change.
- **The demo account** keeps the better of the guest's stored best and the new one in the game's
  direction, in place of `Math.max`; the fake Supabase (`galaxy.fake.ts`) keeps the better in place
  of `score > row.best`.
- **`Account.submitScore`** is documented as answering the better of the two for that game.

### The kart

- `scoreOf`, `RULES.placePoints` and `PAR_SECONDS` go: PAR served only the point score.
- `KartResults` loses `score`; the finish event carries the player's `tenths`, given once, and
  `KartGame.step` answers the time on the step that finishes the race. `ArcadeApp` sends it as it
  sends the score today, `sendScore(KART, tenths)`, and the RETRY on A sends it again.
- **The RESULTS screen** keeps its table of six places and times; the line under it reads
  `TIME 1:42.3` in place of `SCORE 1500`.
- Quitting from the pause still sends nothing, and a race still ends only when the player finishes
  their last lap.

### The guard between the two lists

The list of lowest-wins games lives twice: in the SQL function, and as `measure: 'time'` in the
registry. A test reads the migration and fails when a `time` game of `GAMES` is missing from the SQL
list, or when the SQL list names a game the registry does not mark `time`.

## Decisions

- **Two PRDs, the time first.** The idea also asked for scenery on the horizon outside the circuit.
  The scenery and the time are independent (one is drawing, the other a stored contract), so the
  person split them: this PRD is the time; the scenery is the next brainstorm. The time goes first
  because every race played today writes another point score that would need resetting.
- **The kart's point scores are reset,** chosen by the person over a new game key (`kart-time`) or
  keeping the points until each player's first time. The CREW TOP 5 of the kart starts empty.
- **The whole race's time,** its three laps, which the race already counts (`tenths`). A best lap
  would mean timing each lap, a feature of its own, and is out of scope.
- **A direction per game in the contract,** chosen by the person over storing `9 999 999 − time`
  (the smallest diff, but the stored number would lie, in the export as everywhere) and a separate
  `arcade_times` table with its own `submit_time()` (everything doubled for one idea).
- **Same signature, so no regenerated types.** The direction is decided inside `submit_score()`,
  never sent by the browser.
- **The voice's objection, accepted.** persona:B-E DEv objected: "A list of games written in
  `submit_score()` and copied into the TypeScript registry is two truths about the same game that
  will drift apart." Settled `accepted`: the test of **The guard between the two lists** fails the
  build when they differ. A table of games read by both, which would remove the copy, was offered
  and not taken: it costs new grants, a declared read and regenerated types.
- **The kart's own words on the end line** (`SAVING TIME…`, `TIME NOT SAVED`), and the other two
  games' words unchanged, approved by the person.
- **The deployment window is accepted** (see **Risks**): no guard parameter, so the signature stays.
- **No browser acceptance scenario:** `acceptance.enabled` is off in this repository; every criterion
  below is proven by ordinary tests and by `supabase/checks/access.sql`.
- **No proof video:** the person said no.

## User stories

- As a crew member racing OMNI KART, at the finish I see my race time and whether it is my new best,
  so I know whether I beat myself.
- As a crew member at the arcade, OMNI KART's cabinet shows the crew's five fastest times, fastest
  first, so I know the time to beat.
- As a guest playing the demo, my best time is kept in my browser, the lowest one.
- As a player of ENTROPY INVADERS or SUPER OMNI WORLD, nothing changes: my score, its words and its
  table are what they were.

## Scope

**In:** the migration (the direction per game, the kart's reset, the grants); its proof in
`supabase/checks/access.sql`; `measure` in the registry and `measure.ts`; the shared readers
(`loadScores`, `isNewBest`, `withBest`, `sendLine`, `TopFive`, the demo account, the fake Supabase);
the kart's finish, results screen and the points' removal; the guard test between the two lists;
the docs that say a score keeps the higher (`apps/galaxy/README.md`, `game/README.md`, the
migration's own header).

**Out:** scenery on the horizon (the next PRD); the cabinet's attract art (a separate visual fix); a
best lap or lap splits; storing the rivals' times; any change to driving, items, rivals or the
circuit; the weekly export's order; a minimum plausible time or any anti-cheat (a score is what the
browser sends, as today); ENTROPY INVADERS' and SUPER OMNI WORLD's scores; the play dock, which does
not send the kart.

## Test seams

As `omni kb show testing` says: tests beside the code, on fixtures, never calling Supabase; the
narrowest test that proves each risk; the existing pins of ENTROPY INVADERS and SUPER OMNI WORLD kept
unchanged, as the characterization that nothing moved for them.

- **SQL** (`supabase/checks/access.sql`, a CI step of the `supabase` workflow): for `kart`, 1200 then
  1500 returns 1200, then 900 returns 900, and `at` moves only on 900; ENTROPY INVADERS still keeps
  the higher (its pins stay). The reset cannot be watched there, since every migration runs before
  the check: the guard test below also checks that the migration deletes the `kart` rows, and the
  seed holds none.
- **`measure.ts`** (unit): better, best of two and order for each measure; `9 210` for points and
  `1:42.3` for a time; an unknown game is `points`.
- **The guard** (unit): the registry's `time` games and the SQL list in the migration are the same
  set; a fixture with one missing on either side fails; the migration deletes the `kart` rows.
- **`data/scores.test.ts`:** the kart's top five, fastest first, the earlier of two equal times first;
  the fake keeps the lower time for `kart` and the higher score for `invaders`.
- **`scenes/invaders-score.test.ts`:** `withBest` and `isNewBest` for a time (a first time is a NEW
  BEST, a slower one changes nothing, the table stays fastest first and keeps five); the lines
  `SAVING TIME…`, `TIME NOT SAVED`, `YOUR BEST 1:42.3`.
- **`account-demo.test.ts`:** the demo keeps the lower time for `kart`.
- **`scenes/games.test.ts`:** `TopFive` shows `1:42.3` on OMNI KART's cabinet and digits on the
  others.
- **`kart/race.test.ts`:** the finish event carries the tenths, once; quitting still sends nothing;
  the pins of `scoreOf` go with it.
- **`scenes/kart.test.ts`:** RESULTS shows `TIME 1:42.3` and the kart's send lines.

## Risks

**What merging publishes** (`omni kb show releasing`): the merge to `main` touches
`supabase/migrations/`, so the `supabase` workflow's `deploy` job applies the migration to the
production project once `SUPABASE_PROJECT_ID` is set: `submit_score()` is replaced and every `kart`
row of `arcade_scores` is deleted. The arcade's new code ships with the galaxy app's deploy.

- **The reset cannot be undone by a revert.** The deleted rows are in the weekly backups the `game`
  workflow exports (kept 90 days) and in point-in-time recovery; they hold points, which the kart no
  longer reads.
- **The deployment window, accepted.** A tab opened before the deploy keeps the old code and still
  sends points. Finished after the migration, such a race stores its points as a time: a sixth place
  at 100 points becomes an unbeatable `0:10.0`. No threshold separates the two, since points (100 to
  about 2500) and real times overlap. It takes a race finished in a stale tab at the moment of the
  deploy, at a crew's scale. The remedy: a person deletes that player's `kart` row.
- **Two lists of lowest-wins games** (SQL and the registry) could drift: the guard test fails the
  build when they do.
- **The shared readers move for every game.** ENTROPY INVADERS' and SUPER OMNI WORLD's existing tests
  stay unchanged and must pass as they are.

**Rollback:** revert the feature PR, and add a migration that puts `greatest()` back for every game
and deletes the `kart` rows again (they would then hold times the old code reads as points).

## Acceptance criteria

1. Finishing a race shows `TIME m:ss.t`, the player's race time, on the RESULTS screen where
   `SCORE n` was; the kart shows no point score anywhere.
2. At the finish, the kart sends the player's race time in tenths of a second under `kart`, once;
   quitting from the pause sends nothing.
3. `submit_score()` keeps the lower of the stored time and the one sent for `kart` (1200 then 1500
   keeps 1200; then 900 keeps 900), moving `at` only when the time improves, and keeps the higher
   score for every other game, as before.
4. Once the migration has run, `arcade_scores` holds no `kart` row from before it.
5. OMNI KART's cabinet shows the CREW TOP 5 as times (`m:ss.t`), fastest first, the earlier of two
   equal times first.
6. The kart's end line reads `SAVING TIME…`, then `NEW BEST` when the time is the player's first or
   faster than their best before, `YOUR BEST m:ss.t` otherwise, or `TIME NOT SAVED` with RETRY on A.
7. The demo keeps the guest's lowest kart time.
8. ENTROPY INVADERS and SUPER OMNI WORLD keep their scores, their end lines and their tables'
   order: their existing tests pass unchanged.
9. A test fails when a `time` game of the registry is missing from the SQL list of lowest-wins
   games, or when that list names a game the registry does not mark `time`.
