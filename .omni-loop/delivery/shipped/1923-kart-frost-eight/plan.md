# Plan: OMNI KART's second circuit, FROST EIGHT, a figure eight in the snow that crosses on a frozen lake

PRD #1923, specified in `spec.md` beside this plan. The feature branch `feat/kart-frost-eight` merges
into `main` through one feature PR (`Closes #1923`); each slice is a sub-PR from
`feat/kart-frost-eight--<slice>` into the feature branch (`Part of #1923`). One landing: the
migration only adds a board that the code of the same merge sends to, so they ship together, as PRD
1440 and PRD 1698 did.

The objection of persona:Lead Engineer, accepted in the spec's **Decisions**, shapes the first slices.
The branch at the crossing (s1) and the surfaces (s3) change the kart's engine and nothing a player
sees. The board and its migration (s2) and MULTI's `track` (s4) are each a slice of their own. All of
them merge before the circuit (s5).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | the branch a kart is on: `locate` looks only at the stretches within 6 tiles of the hint, either way along the line, and answers today's answer without one; every kart carries the distance along the line it had a step before, through its progress, the places, the rivals' aim and the way back; `trackProblems` refuses a line that crosses itself on ground that is not level, with a gate or a start line within 8 tiles of the crossing, or at less than 60°; COMET RING answers and drives as today | `apps/galaxy/src/arcade/kart/line.` `apps/galaxy/src/arcade/kart/track.` `apps/galaxy/src/arcade/kart/kart.` `apps/galaxy/src/arcade/kart/rivals.` `apps/galaxy/src/arcade/kart/race.` | — | 1 |
| s2 | the board `kart-frost-eight`: one migration, the newest, replaces `submit_score` so that `kart-frost-eight` is accepted when the player has `kart` unlocked and keeps the lowest time, and it deletes or rewrites no row; its check in `supabase/checks/`; the registry's OMNI KART names its two time boards, `kart` (COMET RING) and `kart-frost-eight` (FROST EIGHT); `measure.guard.test.ts` holds the SQL list equal to the registry's time boards; `readScores` reads both, lowest first, and the demo keeps the lowest of each | `supabase/migrations/` `supabase/checks/` `apps/galaxy/src/arcade/games/index.` `apps/galaxy/src/arcade/measure.` `apps/galaxy/src/arcade/account-demo.` `apps/galaxy/src/data/scores.` `apps/galaxy/src/data/arcade.test.ts` | — | 1 |
| s3 | the surfaces: the surface at a pixel, `road`, `ice`, `powder` or `void`, beside `roadAt`; on powder the top speed is capped at 0.55 × and a kart never tips over; on ice the top speed is kept and the direction of travel turns towards the heading at 1.2 radians a second, never more than 0.6 behind; elsewhere the direction of travel is the heading; the tree line stops a kart; the tip-over reads the void; the rivals drive the same model; COMET RING drives as today | `apps/galaxy/src/arcade/kart/track.` `apps/galaxy/src/arcade/kart/kart.` `apps/galaxy/src/arcade/kart/fx.` `apps/galaxy/src/arcade/kart/rules.` `apps/galaxy/src/arcade/kart/rivals.` `apps/galaxy/src/arcade/kart/race.` | s1 | 2 |
| s4 | MULTI's circuit: the register of circuits, with COMET RING as its only circuit; the chosen circuit kept in `omni-loop:kart-options` as `track`, where none, or one naming no circuit, reads as COMET RING; each Presence entry carries the player's `track`; `start` carries an optional `track`, where none races COMET RING and one naming no circuit is ignored; the grid races its first arrival's circuit; the channel `kart:<workspace>` is unchanged | `apps/galaxy/src/arcade/kart/circuits.` `apps/galaxy/src/arcade/kart/options.` `apps/galaxy/src/arcade/kart/net.` `apps/galaxy/src/arcade/kart/hub.` `apps/galaxy/src/arcade/kart/grid.` `apps/galaxy/src/arcade/kart/index.` | — | 1 |
| s5 | FROST EIGHT joins the register: its 8 waypoints and radii from the spec's table, on 72×72 tiles, width 5; the start line at x = 32 heading east; its diagonals cross at about 62° on a level lake 12 tiles across; the pass on the top loop; the boxes and the boost pads; its surface is ice across the lake, road on the rest of the road, powder elsewhere, and never void; the tree line; the five rivals finish three laps on it | `apps/galaxy/src/arcade/kart/track.` `apps/galaxy/src/arcade/kart/circuits.` `apps/galaxy/src/arcade/kart/relief.` `apps/galaxy/src/arcade/kart/race.` | s1, s3, s4 | 3 |
| s6 | FROST EIGHT's look: its powder, ice, asphalt, snow banks and red-and-white kerbs; its pale sky over peaks with a low sun, and flakes that stand still under reduced motion; pines, chalets, lift pylons, snowmen, signs, stands and the wooden arch over the start; the minimap with the lake in light blue; COMET RING's look unchanged | `apps/galaxy/src/arcade/kart/texture.` `apps/galaxy/src/arcade/kart/mode7.` `apps/galaxy/src/arcade/kart/art.` `apps/galaxy/src/arcade/kart/palette.` | s5 | 4 |
| s7 | the CIRCUIT step, after SINGLE and after MULTI: ◀ ▶ between COMET RING and FROST EIGHT, each with its name, its 72 px minimap and the player's best (`NO TIME YET`); the hint `◀ ▶ CHOOSE · A RACE · B BACK` (`A GRID` after MULTI); it opens on the circuit kept; the ready screen's title and ready line name the circuit kept; a race finished on a circuit sends its time to that circuit's board; the grid shows its circuit's name, and each player's best there is on that circuit | `apps/galaxy/src/arcade/scenes/kart.` `apps/galaxy/src/arcade/ArcadeApp.tsx` `apps/galaxy/src/arcade/kart/art.` | s2, s4, s6 | 5 |
| s8 | the cabinet's turns: OMNI KART's lit cabinet shows its circuits in turn, five seconds each, with a cut: the circuit's still, then `CREW TOP 5` with the circuit's name at its right, over that board's five best; each turn has its own `NO SCORES YET` or `SCORES OUT OF REACH`; FROST EIGHT's still of its start; COMET RING's still unchanged | `apps/galaxy/src/arcade/scenes/games.` `apps/galaxy/src/arcade/games/stills.` `apps/galaxy/src/arcade/games/still.` `apps/galaxy/src/data/arcade.test.ts` | s2, s6 | 5 |
| s9 | OMNI KART's section of `apps/galaxy/README.md` says how the race is now: the two circuits and the CIRCUIT step; FROST EIGHT's crossing, its powder, its ice and slide, and its tree line; the two boards; and the cabinet's turns | `apps/galaxy/README.md` | — | 1 |

**Shared ground.** OMNI KART's engine is a few files that s1, s3 and s5 all pass through. Those
slices run one wave after another, each on top of the one before:

- `apps/galaxy/src/arcade/kart/track.` (`track.ts`, `track.test.ts`): s1 (the crossing's checks),
  s3 (the surface at a pixel) and s5 (FROST EIGHT's source). Waves 1, 2 and 3.
- `apps/galaxy/src/arcade/kart/race.` (`race.ts`, `race.test.ts`, `race.multi.test.ts`): s1 (the
  branch through the progress and the places), s3 (the surface each step reads) and s5 (the race on
  FROST EIGHT). Waves 1, 2 and 3.
- `apps/galaxy/src/arcade/kart/kart.` and `kart/rivals.` (each with its tests): s1 (the branch every
  kart carries, the rivals' aim and the way back) and s3 (the surfaces and the slide). Waves 1 and 2.
- `apps/galaxy/src/arcade/kart/circuits.` (new): s4 makes the register with COMET RING alone, and s5
  adds FROST EIGHT to it. Waves 1 and 3. The directory is not new, so the file's prefix is enough.
- `apps/galaxy/src/arcade/kart/art.` (`art.ts`, `art.test.ts`): s6 (FROST EIGHT's scenery and
  minimap) and s7 (`createKart` racing the chosen circuit). Waves 4 and 5.
- `apps/galaxy/src/data/arcade.test.ts` renders the game room (`GamesOverlay`) from the scores the
  page reads. It belongs to s2 (both boards read) and to s8 (the cabinet's turns). Waves 1 and 5.
- `apps/galaxy/src/arcade/games/stills.test.ts` draws the stills with `kart/art`, `kart/mode7` and
  `kart/race`. Only s8 changes it, by adding FROST EIGHT's still. Every slice before s8 keeps it green
  without `-u`, which holds COMET RING's still as it is.
- s7 and s8 share wave 5 because their territories do not meet. The scenes outside `arcade/kart/`
  import nothing from inside it (`kart/guard.test.ts`), so the cabinet reads the circuits' names from
  the registry's boards (s2), never from the register.
- s2's `supabase/` paths, s4's MULTI files and s9's README are shared with no other slice, so they
  build in wave 1 beside s1.

## Per slice: done when

**s1** (`ui: yes`), the branch at the crossing
- `kart/line.test.ts`: on a line that crosses itself, `locate` with a hint on either branch answers
  that branch at the crossing; without a hint, over a grid of points on COMET RING, it answers
  exactly what it answers today.
- `kart/track.test.ts`: a test line that crosses itself is refused, naming why, when its crossing is
  not level, when a gate or a start line is within 8 tiles of the crossing, or when it crosses at
  less than 60°; COMET RING passes its checks as today.
- `kart/race.test.ts` and `kart/rivals.test.ts`: on a test line that crosses itself, no kart's
  progress goes back while it crosses, no lap is counted twice, and a rival's aim and a kart's way
  back stay on the branch it came from; every test of today passes unchanged.

**s2** (`ui: yes`), the board `kart-frost-eight`
- A new migration under `supabase/migrations/`, dated after `main`'s newest
  (`node scripts/migration-order.ts` green), replaces `submit_score()`. It accepts `kart-frost-eight`
  for a player with `kart` unlocked, keeps the lower of the stored and the sent time, and deletes or
  rewrites no row. Its comment names PRD 1923 and the rollback: a migration that restores today's
  function.
- A check in `supabase/checks/`: a player with `kart` unlocked submits to `kart-frost-eight` and keeps
  the lower of two times; one without it is refused; a time on `kart-frost-eight` changes nothing on
  `kart`. CI's `supabase` job applies every migration to an empty database and runs it green.
- `measure.guard.test.ts` reads the newest migration that defines `submit_score()`, and its
  `lowest_wins` list equals the registry's time boards, `kart` and `kart-frost-eight`.
- `data/scores.test.ts`: `readScores` reads `kart` and `kart-frost-eight`, each lowest first;
  `account-demo` keeps the lowest of each; `supabase/database.types.ts` does not change.
- The rules on these files hold for the new board: its rows go with a member who leaves, as every
  `arcade_scores` row does (BR-PRODUCT-35), and it is read only for players who linked GitHub
  (BR-PRODUCT-36).

**s3** (`ui: yes`), the surfaces
- `kart/track.test.ts`: on COMET RING the surface is `road` wherever `roadAt` is true and `void`
  elsewhere.
- `kart/kart.test.ts`, on a test circuit with ice and powder: on powder the speed settles at 0.55 ×
  the top speed and the kart never tips over; on ice the gap between heading and travel grows while
  steering and never passes 0.6 radians, and closes at 1.2 radians a second; on road the direction
  of travel is the heading at every step; at the tree line a kart stops.
- `kart/race.test.ts` and `kart/rivals.test.ts`: the rivals obey the same model, and every test of
  today passes unchanged.

**s4** (`ui: yes`), MULTI's circuit
- `kart/options.test.ts`: `track` is kept and read back; a store without it, or one naming no
  circuit, reads as COMET RING.
- `kart/net.test.ts`: a start with `track` reads; a start without one reads as COMET RING; a start
  whose `track` names no circuit is not read. A Presence entry carries its `track`.
- `kart/hub.test.ts` and `kart/grid.test.ts`: the grid races the circuit of its first arrival, as it
  races their laps; the channel is still `kart:<workspace>`.

**s5** (`ui: yes`), FROST EIGHT
- `kart/track.test.ts`: `trackProblems(FROST_EIGHT)` is empty; its 8 waypoints and radii are those of
  the spec's table; its diagonals cross at 60° or more on a lake 12 tiles across; its surface is
  `ice` across the lake, `road` on the rest of the road, `powder` everywhere else on the map, and
  never `void`.
- `kart/race.test.ts`: on FROST EIGHT, on seeds 1, 7 and 42, at the levels easy, normal and hard,
  the five rivals finish three laps; no kart's progress goes back while it crosses the lake; no lap
  is counted twice.
- A test inside `arcade/kart/` holds the register's circuits equal to the registry's kart boards
  (s2), by id and name and in the same order.

**s6** (`ui: yes`), FROST EIGHT's look
- `kart/texture.test.ts` and `kart/art.test.ts`: FROST EIGHT's ground draws powder, ice, asphalt,
  snow banks and kerbs; its sky, peaks and sun; its props and the arch over the start; and its
  minimap with the lake in light blue. The flakes stand still under reduced motion.
- `kart/mode7.test.ts`: at every waypoint of FROST EIGHT facing the next one, on the wide and the
  tall grid, the floor takes at most 600 samples a column, as it does on COMET RING.
- COMET RING's look is unchanged: `games/stills.test.ts` stays green without `-u`.

**s7** (`ui: yes`), the CIRCUIT step
- `scenes/kart.test.ts`: the CIRCUIT step comes after SINGLE and after MULTI; ◀ ▶ moves between
  COMET RING and FROST EIGHT; A races (SINGLE) or goes to the grid (MULTI); B goes back; the step
  opens on the circuit kept; it shows the player's best on each, or `NO TIME YET`; the hint reads
  `◀ ▶ CHOOSE · A RACE · B BACK`, or `A GRID` after MULTI; the ready title and ready line read
  `FROST EIGHT · 3 LAPS` when FROST EIGHT is kept.
- A race finished on FROST EIGHT sends its time to `kart-frost-eight`, and one on COMET RING to
  `kart`.
- The grid shows its circuit's name, and each player's best on it is their time on that circuit.
- `kart/guard.test.ts` stays green: nothing outside `arcade/kart/` imports the register at run time.
- The step, drawn on the wide grid, matches the `kart-circuit` draft screen
  (`.omni-loop/knowledge/design/screens/kart-circuit.html`).

**s8** (`ui: yes`), the cabinet's turns
- `scenes/games.test.ts`: OMNI KART's lit cabinet shows COMET RING's still, then `CREW TOP 5` with
  `COMET RING` at its right over `kart`'s top five. Five seconds later it cuts to FROST EIGHT's,
  over `kart-frost-eight`'s. Each turn shows its own `NO SCORES YET` or `SCORES OUT OF REACH`; the
  player's own line is highlighted. A · PLAY opens OMNI KART whatever the turn.
- `games/stills.test.ts`: FROST EIGHT's still of its start is added, drawn again with `-u` and
  checked by eye; COMET RING's still is unchanged.
- `data/arcade.test.ts` renders the room with both boards, read only for players who linked GitHub
  (BR-PRODUCT-36).
- The cabinet matches the `game-room` draft screen's after (OMNI KART's turns).

**s9**, the README
- OMNI KART's section of `apps/galaxy/README.md` names the two circuits and the CIRCUIT step;
  FROST EIGHT's crossing, powder, ice and slide, and tree line; the boards `kart` and
  `kart-frost-eight`; and the cabinet's turns. It uses the section's own words, and "Nothing off
  the road slows a kart" is changed where it no longer holds.
