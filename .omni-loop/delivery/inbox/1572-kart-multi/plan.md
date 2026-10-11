# Plan: OMNI KART races SINGLE or MULTI, live against the workspace

PRD #1572, specified in `spec.md` beside this plan. The feature branch `feat/kart-multi` merges into
`main` through one feature PR (`Closes #1572`); each slice is a sub-PR from `feat/kart-multi--<slice>`
into the feature branch (`Part of #1572`). One landing: the migration and the code that joins the
grid ship in the same merge, and the spec accepts the window between them (**Risks**): until the
policies are applied, the grid reads `GRID OUT OF REACH` and SINGLE plays.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | OMNI KART's ready screen offers `SINGLE` and `MULTI` under `COMET RING · 3 LAPS`, the cursor on `SINGLE`; `SINGLE` leads to today's ready line and today's race, word for word; `Account` gains an optional `kartGrid()` port, and an account without a link reads `MULTI · SIGN IN TO RACE`, which cannot be picked | `apps/galaxy/src/arcade/scenes/kart.` `apps/galaxy/src/arcade/ArcadeApp.tsx` `apps/galaxy/src/arcade/types.ts` | — | 1 |
| s2 | only a player of the workspace with OMNI KART unlocked can receive or send Broadcast and Presence messages on `kart:<workspace id>`, proven by `supabase/checks/kart_grid.sql`, and an ADR records that the live race runs over a private Supabase Realtime channel, each browser owning its own kart | `supabase/migrations/` `supabase/checks/kart_grid.sql` `supabase/database.types.ts` `.omni-loop/knowledge/adr/` | — | 1 |
| s3 | `MULTI` joins the workspace's grid through the Supabase account's `kartGrid()` and `data/kart-grid.repository.ts`; the GRID lists the players in starting order by best time, the first to arrive reads `START RACE`, the others `WAITING FOR <NAME>`, alone `WAITING FOR RACERS`; four places and `GRID FULL · 4 RACERS`; B goes back to the choice; `GRID OUT OF REACH · A TO RETRY` and `RECONNECTING…`; the in-memory hub proves it | `apps/galaxy/src/arcade/kart/grid` `apps/galaxy/src/arcade/kart/net` `apps/galaxy/src/arcade/kart/hub` `apps/galaxy/src/arcade/kart/rules.ts` `apps/galaxy/src/arcade/kart/index.ts` `apps/galaxy/src/data/kart-grid.repository.` `apps/galaxy/src/arcade/account-supabase.` `apps/galaxy/src/arcade/types.ts` `apps/galaxy/src/arcade/scenes/kart.` `apps/galaxy/src/arcade/ArcadeApp.tsx` | s1 | 2 |
| s4 | START puts every player of the grid into the same countdown on the first places in starting order; each browser drives its own kart and sends its state at the send rate (10, 8, 5 a second at two, three, four players), draws the others carried forward for at most half a second, in its way and never moved; only your own kart takes a box; the race's line shows your place among the players and no CPU kart; ENTER and a lost focus open `BACK TO RACE` / `LEAVE RACE`; a hidden tab leaves the race; a player silent for 10 seconds is OUT; a late arrival reads `RACE ON · <n> RACERS` | `apps/galaxy/src/arcade/kart/` `apps/galaxy/src/arcade/scenes/kart.` `apps/galaxy/src/arcade/ArcadeApp.tsx` `apps/galaxy/src/arcade/games/stills` | s3 | 3 |
| s5 | crossing the line at the end of the third lap sends the `finish` and the time to `submit_score()`; RESULTS lists the players by finish time and fills in live, `—` still racing and `OUT` left; A goes back to the grid, B to the game room; the grid starts its next race only once every player of the last one finished or is OUT | `apps/galaxy/src/arcade/kart/race` `apps/galaxy/src/arcade/kart/net` `apps/galaxy/src/arcade/kart/grid` `apps/galaxy/src/arcade/kart/hub` `apps/galaxy/src/arcade/kart/art` `apps/galaxy/src/arcade/scenes/kart.` `apps/galaxy/src/arcade/ArcadeApp.tsx` | s4 | 4 |
| s6 | a BLOB dropped and an ORB fired are sent with an id of their own and appear on every player's circuit; the player hit alone decides the hit, is spun out, and the `hit` takes the item off every circuit; a BOOST stays your own; OMNI KART's section of the galaxy README says how MULTI races | `apps/galaxy/src/arcade/kart/` `apps/galaxy/src/arcade/ArcadeApp.tsx` `apps/galaxy/README.md` | s4 | 5 |

**Shared ground.** Every slice but s2 builds on OMNI KART's scene and engine, so they run one wave
after another and each edits these files on top of the one before:

- `apps/galaxy/src/arcade/scenes/kart.` (the scene, its text layer, its CSS and `kart.test.ts`):
  s1 (the choice), s3 (the GRID), s4 (the race's line and menu), s5 (the live RESULTS). Waves 1, 2,
  3 and 4.
- `apps/galaxy/src/arcade/ArcadeApp.tsx`: s1 (the choice's presses), s3 (the link's life), s4 (the
  send rate in the frame loop, the hidden tab), s5 (the multi finish's score), s6 (a remote item's
  sound). Waves 1 to 5.
- `apps/galaxy/src/arcade/types.ts`: s1 (the optional `kartGrid()` port) and s3 (`KartLink`'s
  shape). Waves 1 and 2.
- `apps/galaxy/src/arcade/kart/` (s4 and s6 own the whole folder; s3 and s5 name the files they
  change in it): `net`, `grid` and `hub` are s3's first, then s4's, s5's and s6's; `race` and `art`
  are s4's, s5's and s6's; `rules.ts` and `index.ts` are s3's, then s4's and s6's. Waves 2 to 5.
  s5 and s6 are both blocked by s4 alone, and share `race`, `net` and `hub`, so s6 is raised to
  wave 5, after s5.
- `apps/galaxy/src/arcade/games/stills` (`stills.test.ts` draws a race through `kart/race` and
  `kart/art`) is s4's alone: the race's new mode is added there, and later slices keep the `single`
  race the stills draw.
- s2's territory (`supabase/`, the ADRs) is shared with no slice, so it builds in wave 1 beside s1.

## Per slice: done when

### s1: the choice

- The ready screen shows `COMET RING · 3 LAPS`, then `SINGLE` and `MULTI`, the cursor on `SINGLE`;
  ▲ and ▼ move the cursor, A or START picks, B goes back to the game room (`scenes/kart.test.ts`).
- Picking `SINGLE` shows today's `READY_LINE` (`COMET RING · 3 LAPS · PRESS START`), and START runs
  today's race: every existing test under `apps/galaxy/src/arcade/kart/` and `scenes/kart.test.ts`
  passes unchanged.
- `Account` has an optional `kartGrid()`; an account without it, or whose `kartGrid()` answers
  null (the demo, the closed arcade, and Supabase until s3), reads `MULTI · SIGN IN TO RACE`, and the
  cursor skips it.
- `kart/guard.test.ts` stays green: nothing outside `arcade/kart/` imports it at run time.

### s2: who may join

- A migration stamped after the newest one on `main` adds, on `realtime.messages`, a `select` and an
  `insert` policy for `authenticated` on the `broadcast` and `presence` extensions, both true only
  when `realtime.topic()` is `kart:<workspace id>` and the caller has a `players` row in that
  workspace whose `player_xp.unlocked` holds `kart`: the check `submit_score()` makes, in a
  `security definer` function with an empty `search_path`, every grant stated (revoked, then
  granted). Its header says why, naming PRD #1572.
- `supabase/checks/kart_grid.sql` proves: a player of the workspace with `kart` unlocked receives
  and sends on its topic; a player of another workspace, a player without `kart`, a signed-in user
  with no player row, and `anon` are refused; a topic that is not `kart:<uuid>` is refused.
- `supabase/database.types.ts` matches the schema (`node scripts/supabase-types.ts --check` passes).
- A new ADR under `.omni-loop/knowledge/adr/`, listed in its README, records the live race's
  transport: a private Supabase Realtime channel per workspace, each browser owning its own kart and
  the player hit deciding a hit, the user's own session (never the service key, ADR-0051), and the
  80-messages-a-second budget, with the lockstep and the authoritative server it was chosen over.

### s3: the grid

- `kart/grid.ts` (pure): the starting order puts the fastest best time on pole, then by best time,
  the players with no time behind, and a tie by arrival; the first four by arrival hold the places
  and a fifth waits, taking the first place that frees in arrival order; the player who starts is the
  first to arrive among those holding a place, and the next takes over when they leave
  (`kart/grid.test.ts`).
- `kart/net.ts` (pure): a Presence entry (id, name, hero, fleet, best time, arrival) reads back from
  what was sent, and one with a missing or wrong field reads as nothing (`kart/net.test.ts`).
- `data/kart-grid.repository.ts` opens the private channel `kart:<workspace id>` with Presence keyed
  by the player's id and Broadcast without its own echo, tracks, sends, unsubscribes and holds no
  rule; its test runs on a stubbed Supabase client. The Supabase account's `kartGrid()` answers a
  `KartLink` built on it; the layering check stays green (only a repository opens the channel).
- `kart/hub.fake.ts` wires two to five `KartLink`s in memory, with a delay and a dropped message set
  by the test; through it, two to five players see the same grid in the same order, and the fifth
  reads `GRID FULL · 4 RACERS`.
- The GRID screen lists each player's hero, name and best time or `NO TIME`; it reads
  `WAITING FOR RACERS` alone, `START RACE` for the first to arrive and `WAITING FOR <NAME>` for the
  others; B leaves the grid for the choice; a refused or unreachable join reads
  `GRID OUT OF REACH · A TO RETRY` and A tries again; a dropped channel reads `RECONNECTING…`
  (`scenes/kart.test.ts`).
- Leaving the kart scene, B on the grid, and the page closing all leave the channel.

### s4: the live race

- START (or A) on `START RACE` sends a `start` with a race id, a seed and the starting order; every
  player in that order, and only them, enters `3 · 2 · 1 · GO` when it arrives, standing on the first
  places of COMET RING in that order; each race clock starts at that player's GO (hub tests).
- `newRace` takes a `single` or `multi` mode; a `multi` race has no CPU karts, and every `single`
  test passes unchanged, the stills included.
- Each browser sends its kart's `state` at `rateFor(n)`: 10 a second at two players, 8 at three, 5
  at four, and `n² × rateFor(n)` is at or under 80 for every `n` from 1 to 4 (`kart/net.test.ts`).
- A remote kart is drawn from its last state carried forward along its speed and heading, never
  more than half a second; it is in your kart's way and never moved by a push; only your own kart
  takes a box (`kart/race.test.ts`).
- The race's line shows your place among the players (1 to `n`), the lap, the time and your item.
- ENTER, and a window losing focus, open `BACK TO RACE` / `LEAVE RACE` while the race goes on; only
  ENTER goes back; `LEAVE RACE` sends a `leave`, sends nothing to the score and goes back to the grid.
- A hidden tab sends a `leave` at once and nothing to the score; back on the tab, the screen reads
  `YOU LEFT THE RACE` with A for the grid.
- A player no state has come from for 10 seconds is OUT on every other screen and their kart is
  gone (hub test, with the dropped player's messages cut).
- A player who joins while a race is on reads `RACE ON · <n> RACERS` and waits.
- A message that does not read, or one from another race, is ignored (`kart/net.test.ts`).

### s5: the finish

- Crossing the line at the end of the third lap sends a `finish` with the time in tenths, and the
  arcade sends that time through `submit_score()` as a solo race does; the cabinet keeps the better
  of it and the stored best.
- RESULTS lists the players by finish time, fills in as each `finish` arrives, reads `—` for a
  player still racing and `OUT` for one who left; A goes back to the grid, B to the game room
  (`scenes/kart.test.ts`, hub tests).
- The grid's next race can start only once every player of the last one has finished or is OUT;
  until then a player back on the grid reads `RACE ON · <n> RACERS` (`kart/grid.test.ts`).
- Leaving before the line, by any route, sends nothing to the score.

### s6: items between players

- A BLOB dropped and an ORB fired send an `item` with an id of their own (the sender's id and a
  count) and appear on every player's circuit; an ORB flies at the kart its sender aimed at.
- Your browser alone decides whether a BLOB or an ORB hits your kart: it spins out and sends a `hit`,
  which takes that item off every circuit; an item that hits a remote kart on your screen waits for
  that player's `hit` or its own end (`kart/race.test.ts`, `kart/items.test.ts`).
- A hub test: an ORB fired by A spins B out on both screens, and the item is gone on both.
- A BOOST stays your own and sends no `item`.
- OMNI KART's section of `apps/galaxy/README.md` says how SINGLE and MULTI race: the grid, the
  starting order by best time, the four places, the menu instead of the pause, the hidden tab, OUT,
  and the time kept as a solo time is.
