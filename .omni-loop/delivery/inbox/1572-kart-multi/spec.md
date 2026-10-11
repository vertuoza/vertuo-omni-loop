---
prd: 1572
title: OMNI KART races SINGLE or MULTI, live against the workspace
blocked-by: none
spec: file
---

# OMNI KART races SINGLE or MULTI, live against the workspace

**Date:** 2026-10-11 · **PRD:** #1572
**Touches:**
- `apps/galaxy/src/arcade/kart/net.ts` (new: the live race's messages, their parsing, the send rate
  and the reading of a remote kart between two messages)
- `apps/galaxy/src/arcade/kart/grid.ts` (new: the starting order and who starts the race)
- `apps/galaxy/src/arcade/kart/race.ts`, `kart/items.ts`, `kart/rules.ts`, `kart/art.ts`,
  `kart/index.ts` (the race's `multi` mode: remote karts, items between players, the results among
  players; the budget and the four places)
- `apps/galaxy/src/arcade/kart/hub.fake.ts` (new, tests only: several live links wired together in
  memory)
- `apps/galaxy/src/arcade/types.ts` (`Account.kartGrid()` and the `KartLink` port),
  `account-supabase.ts`, `account-demo.ts`, `account-closed.ts`
- `apps/galaxy/src/data/kart-grid.repository.ts` (new: the one file that opens the Realtime
  channel)
- `apps/galaxy/src/arcade/scenes/kart.ts`, `kart.tsx`, `kart.css` (the SINGLE / MULTI choice, the
  GRID screen, the race's menu, the results filled live)
- `apps/galaxy/src/arcade/ArcadeApp.tsx` (the choice, the link's life, the send rate in the frame
  loop)
- `supabase/migrations/…_arcade_kart_grid.sql` (new: who may join a workspace's grid; dated after
  the newest migration on `main` when it lands, since CI refuses an overtaken one),
  `supabase/checks/kart_grid.sql` (new)
- `.omni-loop/knowledge/adr/` (new ADR: the live race runs over a private Supabase Realtime
  channel, each browser owning its own kart)
- `apps/galaxy/README.md` (OMNI KART's section)

## Problem

OMNI KART is raced alone: the player starts last on COMET RING against five CPU karts driven by the
workspace's fleet mascots (PRD 1359). Multiplayer was cut from that PRD. Colleagues who reach LV 3
can compare best times on the cabinet's crew table, but they cannot race each other.

## Solution

The ready screen offers **SINGLE** or **MULTI**. SINGLE is today's race, unchanged. MULTI puts the
player on **their workspace's grid**, where up to four players of that workspace race COMET RING
live, each from their own browser.

### The choice

- The ready screen shows two lines, `SINGLE` and `MULTI`, under `COMET RING · 3 LAPS`. ▲ and ▼ move
  the cursor, A or START picks, B goes back to the game room. The cursor starts on `SINGLE`.
- `SINGLE` goes on to today's ready line (`PRESS START`) and today's race, word for word.
- On an account that cannot reach other players (the demo, the closed arcade), the line reads
  `MULTI · SIGN IN TO RACE` and cannot be picked.

### The grid

- `MULTI` joins the workspace's one grid: a private Realtime channel `kart:<workspace id>`, its
  Presence keyed by the player's id. Each player on it says who they are: their id, name, hero, fleet
  and best time at OMNI KART (the one the cabinet's crew table shows), and when they arrived.
- The **GRID** screen lists the players on the grid in their starting order, each with their hero,
  their name and their best time (`1:05.3`), or `NO TIME`.
- **The starting order is the best time:** the fastest best time takes pole, then the others by
  best time; a player with no time starts behind every timed player; a tie, and two players with no
  time, go by arrival on the grid. The order is fixed when the race starts and sent with the start,
  so every player starts from the same grid.
- Alone on the grid, the screen reads `WAITING FOR RACERS`. From two players, the one who arrived
  first reads `START RACE` and starts it with START or A; every other player reads
  `WAITING FOR <NAME>`. When that player leaves, the next by arrival takes over.
- **Four places.** The first four players by arrival hold the places. A fifth reads
  `GRID FULL · 4 RACERS` and waits; they take the first place that frees, in arrival order among
  those waiting. The race starts with the players who hold a place.
- A player who joins while a race is on reads `RACE ON · <n> RACERS` and waits for the next one.
- B leaves the grid and goes back to the choice.

### The start

- START sends the race's `start`: a race id, a seed and the starting order. Every player in that
  order leaves the grid for the countdown as soon as it arrives: `3 · 2 · 1 · GO`, as today.
- Players stand on the first places of COMET RING, pole first, in the starting order.
- Each player's race clock starts at their own GO, so the time the message takes costs no one any
  time.

### The race

- **Each browser drives its own kart** with today's rules, and sends its state (where it is, which
  way it faces, its speed, its laps and waypoints, a spin-out or a fall) at the **send rate**. It
  draws the other players' karts from their last state, carried forward along their speed and
  heading until the next one arrives, for at most half a second.
- **The send rate keeps a race inside 80 Realtime messages a second.** Supabase counts every message
  sent and every message delivered, so a race of `n` players costs `n² × rate` a second: the rate is
  10 a second at two players, 8 at three and 5 at four. The budget and the four places are constants
  of `kart/rules.ts`.
- **Remote karts are in the way, not driven.** Your kart is pushed off a remote kart as it is off a
  rival today; the remote kart does not move on your screen. Only your own kart takes boxes, and a
  box another player took stays on your circuit.
- **Items reach the other players.** A BLOB dropped and an ORB fired are sent, each with an id of its
  own, and appear on every player's circuit; an ORB flies at the kart its sender aimed at, as today.
  **The player hit decides:** your browser alone decides whether a BLOB or an ORB hits your kart,
  and sends the `hit`, which takes that item off every circuit. A BOOST stays your own.
- The race's line shows your place among the players (1 to `n`), the lap, the time and the item you
  hold, as today. There are no CPU karts.
- **No pause.** The race goes on for the others: ENTER opens the race's menu, `BACK TO RACE` (ENTER)
  and `LEAVE RACE` (TAB), while the race goes on and your kart rolls on with nothing pressed. A
  window that loses focus opens the same menu (P-PRODUCT-53: you choose when to go again).
  `LEAVE RACE` sends a `leave`, sends nothing to the score, and goes back to the grid.
- **A hidden tab leaves the race:** a `leave` is sent at once, nothing is sent to the score, and
  when the tab is back the screen reads `YOU LEFT THE RACE` with A for the grid.
- A player no state has come from for 10 seconds is **OUT** on every other screen, and their kart
  is gone from the circuit.

### The finish

- A player who crosses the line at the end of the third lap sends their `finish` with their time,
  and their time is sent to the score through `submit_score`, as a solo race sends it: the cabinet
  keeps the better of the two (PRD 1440).
- The **RESULTS** table lists the players by finish time, fills in as the others cross the line,
  reads `—` for a player still racing and `OUT` for one who left. A goes back to the grid, B to the
  game room.
- The race is over for the grid once every player in it has finished or is OUT; the grid starts the
  next race from there.
- Leaving before the line sends nothing to the score, as in a solo race: no score is reached before
  the finish line (P-PRODUCT-54).

### When the grid is out of reach

- A channel refused (the player is not a player of the workspace, or OMNI KART is not unlocked for
  them) or one that cannot be reached: the GRID reads `GRID OUT OF REACH · A TO RETRY`, and B goes
  back to the choice. SINGLE always plays.
- A channel dropped while waiting reads `RECONNECTING…`; supabase-js reconnects by itself, and the
  player says who they are again once it is back.
- A channel dropped during the race: you race on, alone on your screen, the others going OUT after
  10 seconds; your finish still sends your time to the score, which is a call of its own.
- A message that does not read, or one from another race, is ignored.

### Who may join

- A migration lets an `authenticated` user receive and send Broadcast and Presence messages on the
  topic `kart:<workspace id>` only when they have a `players` row in that workspace and `kart` is in
  their `player_xp.unlocked` there: the check `submit_score()` already makes. Every other join is
  refused. The browser joins with the player's own session; no secret key is used (ADR-0051).
- `supabase/checks/kart_grid.sql` proves it (ADR-0028).

## Decisions

- **Live, online multiplayer,** chosen by the person over a split screen on one keyboard and over
  ghosts of colleagues' best times.
- **One grid per workspace,** chosen by the person over rooms with a code and a list of open rooms:
  no code to share, made for a team.
- **Players only, no CPU karts in MULTI,** chosen by the person over filling the places with CPU
  karts: no browser drives karts for the others, so there is no host to lose.
- **BLOBs and ORBs hit other players in this PRD,** chosen by the person over a first PRD with
  BOOSTs only.
- **A time set in MULTI counts for the best time,** chosen by the person: same circuit, same three
  laps, and P-PRODUCT-54 holds with no new table.
- **The best time sets the starting place,** asked by the person: fastest best time on pole, no time
  behind, arrival order breaks a tie.
- **Each browser owns its own kart, over Supabase Realtime Broadcast and Presence,** chosen by the
  person over inputs-only lockstep (one slow connection stalls everyone, one float apart desyncs the
  race for good) and over an authoritative server outside Vercel (a new deployment and a new ADR of
  its own). An ADR records it.
- **Four places, a budget of 80 messages a second,** chosen by the person as the careful setting,
  since nobody knows the Supabase plan the galaxy runs on: the Free plan allows 100 messages a
  second for the whole project, and going over it disconnects the whole project, the approvals
  stream included ([Supabase › Realtime limits](https://supabase.com/docs/guides/realtime/limits)).
- **The voice's objection, accepted.** persona:F-E Developer objected: "A live netcode written by
  agents is exactly where the bugs nobody can reproduce by hand are born: frozen karts, ghost grids
  that never empty. And if an arcade game saturates Realtime, the approvals stream, the heart of the
  product, goes down with it." Settled `accepted`: the send rate is bound by a fixed budget a test
  holds for every number of players, and an in-memory hub races two to four players in one test
  process, starts, items, drops and OUT included, with no browser (**Test seams**).
- **SINGLE keeps the player last on the grid** (decided while writing this spec, keeping PRD 1359's
  "the player starts last, so the race is a climb"): the best time sets the place in MULTI only.
- **The first player to arrive starts the race** (decided while writing this spec): the player
  waiting longest decides when the grid is full enough, and nobody else can start it under them.
- **A hidden tab leaves the race** (decided while writing this spec): a live race cannot pause for
  one player, and a race clock that skipped the hidden time would make the time unfair. A window
  that only loses focus opens the menu instead.
- **Remote karts are not moved on your screen, and boxes are your own** (decided while writing this
  spec): a remote kart's place is its owner's word, so nothing local overrides it.
- **No plausibility check on a race time** (decided while writing this spec): `submit_score()`
  trusts the browser today for a solo race, and a live race sends its time the same way; a check is
  a PRD of its own.
- **No browser acceptance scenario:** `acceptance.enabled` is off in this repository; every
  criterion below is proven by ordinary tests.
- **No proof video:** the person said no.

## User stories

- As a player at LV 3 or above, I pick MULTI on OMNI KART's ready screen and see the colleagues of
  my workspace waiting on the grid, in the order their best times give.
- As the first player on the grid, I start the race once a colleague has joined, and we race COMET
  RING together, each from our own browser.
- As a racer, I drop a BLOB that spins out the colleague behind me, and I get hit by their ORB.
- As a racer, I cross the line, see my place among the players fill in as the others finish, and
  see my time kept as my best if it beats it.
- As a player who only wants to race alone, I pick SINGLE and get today's race, unchanged.
- As a player whose grid cannot be reached, I read `GRID OUT OF REACH` and still race SINGLE.

## Scope

**In:**
- The SINGLE / MULTI choice on the ready screen, and `MULTI · SIGN IN TO RACE` where no other player
  can be reached.
- The workspace's grid: its screen, its starting order by best time, who starts, four places, the
  waiting, `RACE ON`.
- The live race: each kart sent at the send rate and carried forward between messages, remote karts
  in the way, BLOBs and ORBs between players with the player hit deciding, the menu instead of the
  pause, the hidden tab leaving, OUT after 10 seconds.
- The results among players, filled live, and the time sent to `submit_score()`.
- The out-of-reach and reconnecting lines.
- The migration that limits the grid to the workspace's players with OMNI KART unlocked, and its
  check.
- The ADR, and OMNI KART's section of `apps/galaxy/README.md`.

**Out:**
- CPU karts in a MULTI race.
- More than four places, and more than one grid per workspace (rooms, codes, lists).
- Split screen on one keyboard, ghosts, spectators.
- Any change to SINGLE, to the circuit, or to the items' rules.
- A plausibility check on race times, and any change to `submit_score()` or `arcade_scores`.
- The play dock, which still has no OMNI KART.
- Touch controls beyond the handheld's D-pad and buttons.

## Test seams

Every test is a Vitest test beside the module it tests; none calls GitHub or Supabase (`omni kb show
testing`). The new behaviour is written test-first.

- **`kart/net.test.ts`:** each message (`start`, `state`, `item`, `hit`, `finish`, `leave`) reads
  back from what was sent; a message with a missing or wrong field, or from another race, reads as
  nothing. `rateFor(n)` keeps `n² × rateFor(n)` at or under the budget for every `n` from 1 to the
  places, and is 10, 8 and 5 at two, three and four players. A remote kart read between two states
  is carried forward along its speed and heading, never more than half a second.
- **`kart/grid.test.ts`:** the starting order by best time, no time behind, ties by arrival; the
  player who starts is the first to arrive, and the next takes over when they leave; a fifth player
  waits and takes the first place that frees; a player who arrives during a race waits.
- **`kart/race.test.ts`:** a `multi` race stands the players on the first places in the starting
  order; a remote kart stands where its state puts it and is not moved by a push; a remote BLOB on
  your kart's way spins it and gives a `hit`; your own kart alone takes a box; the results list the
  players only, with `—` and `OUT`; a player silent for 10 seconds is OUT; the `single` race is
  covered by today's tests, which stay as they are.
- **`kart/hub.fake.ts` and its tests** (the objection's answer): two to four live links wired in
  memory, with a delay and a dropped message set by the test. Two to four players start together
  from the same grid; an ORB fired by A spins B on both screens; B dropping is OUT on A's screen
  after 10 seconds; the starter leaving hands the start to the next; a fifth player waits.
- **`data/kart-grid.repository.test.ts`,** on a stubbed Supabase client: the topic
  `kart:<workspace id>`, a private channel, Presence keyed by the player's id, Broadcast without
  its own echo; the repository tracks, sends, unsubscribes and holds no rule.
- **`scenes/kart.test.ts`:** the choice and its cursor, `MULTI · SIGN IN TO RACE` on the demo, every
  line of the GRID screen, the race's menu, the results filled live, `YOU LEFT THE RACE`,
  `GRID OUT OF REACH`.
- **`supabase/checks/kart_grid.sql`:** a player of the workspace with `kart` unlocked receives and
  sends on its topic; a player of another workspace, a player without `kart`, and a signed-in user
  with no player row are refused.
- **Guards that must stay green:** `kart/guard.test.ts` (nothing outside `arcade/kart/` imports it
  at run time) and the layering check (only a repository opens the channel, ADR-0095).

## Risks

**What merging publishes** (`omni kb show releasing`): the merge to `main` applies the migration to
the production Supabase project, and ships the arcade's new code with the galaxy app's deploy. The
migration only adds policies on `realtime.messages` and one function they call; no row is written,
moved or deleted, and `submit_score()` and `arcade_scores` are unchanged.

- **Realtime's quota is the project's, not the arcade's.** Two workspaces racing four players at
  once send 160 messages a second, over the Free plan's 100. The budget and the places are two
  constants of `kart/rules.ts`, which a later PRD lowers or raises once the plan is known.
- **A player can lie about their kart.** Each browser owns its own kart and its own time, as a solo
  race already owns its time. Inside one workspace this is the trust the arcade already gives.
- **The feel over a slow connection.** A remote kart is drawn from a state at most a few hundred
  milliseconds old; on a slow connection it jumps when the next one arrives. It never changes anyone's
  time.
- **The deployment window.** A tab opened before the deploy shows today's ready screen and races
  SINGLE only.

**Rollback:** revert the feature PR, then a migration that drops the policies and the function. No
data to restore.

## Acceptance criteria

1. OMNI KART's ready screen shows `SINGLE` and `MULTI` under `COMET RING · 3 LAPS`, the cursor on
   `SINGLE`; ▲ and ▼ move it, A or START picks, B goes back to the game room.
2. `SINGLE` leads to today's ready line and today's race, unchanged.
3. On the demo and the closed arcade, the line reads `MULTI · SIGN IN TO RACE` and cannot be picked.
4. `MULTI` shows the GRID: the players of the workspace on it, each with their hero, name and best
   time or `NO TIME`, in the starting order.
5. The starting order puts the fastest best time on pole, then the others by best time, the players
   with no time behind, and a tie by arrival on the grid.
6. Alone on the grid, the screen reads `WAITING FOR RACERS`; from two players, the first to arrive
   reads `START RACE` and the others `WAITING FOR <NAME>`; when that player leaves, the next by
   arrival reads `START RACE`.
7. The first four players by arrival hold the places; a fifth reads `GRID FULL · 4 RACERS` and
   takes the first place that frees, in arrival order, and the race starts with the four who hold one.
8. A player who arrives during a race reads `RACE ON · <n> RACERS` and waits for the next one.
9. START puts every player of the grid into the same `3 · 2 · 1 · GO`, on the first places of COMET
   RING in the starting order; each race clock starts at that player's GO.
10. Each player sees the others' karts move on the circuit, drawn from their last state carried
    forward for at most half a second.
11. The send rate is 10 a second at two players, 8 at three and 5 at four, and `n² × rate` never
    passes 80.
12. A remote kart is in your way and never moved on your screen; only your own kart takes a box.
13. A BLOB dropped or an ORB fired by one player appears on every player's circuit; the player hit
    alone decides the hit, is spun out, and the item is gone from every circuit.
14. The race's line shows your place among the players, the lap, the time and the item you hold;
    there are no CPU karts.
15. ENTER, and a window losing focus, open `BACK TO RACE` / `LEAVE RACE` while the race goes on;
    only ENTER goes back to the race, and `LEAVE RACE` goes back to the grid, sending nothing to
    the score.
16. A hidden tab leaves the race at once and sends nothing to the score; back on the tab, the screen
    reads `YOU LEFT THE RACE` with A for the grid.
17. A player no state has come from for 10 seconds is OUT on every other screen, and their kart is
    gone.
18. Crossing the line at the end of the third lap sends the time to `submit_score()`, which keeps
    the better of it and the stored best.
19. RESULTS lists the players by finish time and fills in live, with `—` for a player still racing
    and `OUT` for one who left; A goes back to the grid, B to the game room.
20. The grid starts its next race only once every player of the last one has finished or is OUT.
21. A grid that is refused or cannot be reached reads `GRID OUT OF REACH · A TO RETRY`, B goes back
    to the choice, and SINGLE still plays; a grid that drops while waiting reads `RECONNECTING…`.
22. Only a player of the workspace with OMNI KART unlocked can receive or send on
    `kart:<workspace id>`; `supabase/checks/kart_grid.sql` proves every refusal.
23. Nothing outside `arcade/kart/` imports it at run time, and only a repository opens the channel.
