---
prd: 160
title: Game room — XP, levels and Entropy Invaders
blocked-by: [100]
spec: file
---

# Game room: XP, levels and Entropy Invaders

**Date:** 2026-09-26 · **PRD:** #160 · **Touches:** `game/`, `supabase/`, `.github/workflows/game.yml`,
`apps/galaxy` · **Blocked by:** #100 (Workspaces), whose migration rebuilds `players` and scopes
every game table by workspace

This is the first of several PRDs on arcade games:

1. **This one.** XP and levels from delivery, a game room in the arcade, the level-up moment, and
   the first game, Entropy Invaders, with a crew high-score table.
2. **Later, one PRD per game** (a maze game, a climber, …). Each adds its game to the game room's
   registry and its row to the rulebook's unlock table.

## Problem

The galaxy scores delivery, and forgets it every month.

- **Points last one season.** `score()` in `game/economy.mjs` folds the ledger for one season (a
  UTC month) only. The Hall of Heroes (`packages/galaxy/src/galaxy.mjs`, `heroes`) starts from zero
  on the 1st. Nothing about a player grows from one season to the next.
- **Points buy nothing.** A player's points are a line in a table. There is no progression to
  reach and nothing to open.
- **The arcade has no game to play.** It looks like a cabinet (a canvas, a D-pad, A and B, a
  synth), but every screen is a menu or a view of the galaxy. `act()` in
  `apps/galaxy/src/arcade/ArcadeApp.tsx` fires once per press; nothing reads a button that is held.

## Solution

**Every point a player earns by delivering also counts as XP. XP never resets. Levels unlock
arcade games in a new game room, and the first point unlocks the first game.**

### XP, levels and unlocks: the rules

Every XP number lives in one block of `game/rulebook.mjs`, beside the points it reads:

```js
xp: Object.freeze({
  // Weight of each personal credit. 0 leaves a credit out.
  weights: Object.freeze({ zoneSecured: 1, woundClosed: 1, rescue: 1, expedition: 1, closer: 1 }),
  // LV 1 at the first point; LV n (n ≥ 2) at step·n·(n−1).
  curve: Object.freeze({ first: 1, step: 25 }),
  cap: 99,
  // The level each game unlocks at.
  unlocks: Object.freeze({ invaders: 1 }),
}),
```

- **XP** is the sum, over every season in the ledger, of a login's **positive personal credits**
  as `score()` computes them, each multiplied by its kind's weight, rounded once after summing.
  - The personal credits and their kinds: `zone secured` (`zoneSecured`), `wound closed: <kind>`
    (`woundClosed`), `rescue`, `expedition bonus` (`expedition`) and `closer bonus` (`closer`).
    Night-shift and cross-fleet multipliers apply, as they do to points.
  - **Debits are ignored.** A `zone reverted` credit and a clawback (`clawed: true`) never lower
    XP: the positive credit keeps counting.
  - **Fleet credits don't count.** `planet terraformed` and `decay: …` go to a fleet (`to: null`);
    they are not personal.
  - A personal credit whose kind has no weight is not counted, and a test fails when the economy
    emits one, so a new kind of credit forces a decision here.
- **Level.** 0 XP is no level. LV 1 is reached at `first` XP (the first point), LV *n* at
  `step`·*n*·(*n*−1): LV 2 = 50, LV 3 = 150, LV 5 = 500, LV 10 = 2,250. The level stops at `cap`.
- **Unlocked** is every game whose unlock level the player's level reaches, **added to** the games
  already stored for that login. A game once unlocked stays unlocked, even after a rule change
  lowers the level.
- **Changing the rules** is changing a number in this block and merging it: the next poll
  recomputes every player's XP from the whole ledger with the rules of the day.
- The pure module `game/experience.mjs` holds this: `experience(events, { now, rules })` returns
  each login's XP, `levelFor(xp, rules)` its level, and `unlockedFor(level, stored, rules)` its
  unlocked games. The arcade and the command both use it, so the rules are applied in one place.
- **Playing a game never earns points or XP.**

### The writer: `pnpm game:xp`

- A new command, `game/cli/xp.mjs`, run as the ledger job's next step, right after
  `pnpm game:project`, in `.github/workflows/game.yml`. It takes `--workspace` like the other game
  commands after #100.
- It reads the workspace's whole ledger and its stored `player_xp` rows, computes every login's
  XP, level and unlocked games, and upserts all rows **in one request**.
- Logins are stored lower-cased, as the roster matches them whatever their case.
- It never writes the ledger. If a read fails, it writes nothing and exits non-zero. The ledger
  step has already succeeded, so XP catches up at the next poll.

### The data (after #100, every row belongs to a workspace)

One forward migration, `supabase/migrations/<timestamp>_game_room.sql`, after #100's:

| Table / function | Shape | Who may |
|---|---|---|
| `player_xp` | PK `(workspace_id, github_login)`; `xp integer`, `level smallint`, `unlocked text[]`, `computed_at timestamptz` | Members read (`is_member(workspace_id)`). Only the service role inserts and updates. |
| `arcade_scores` | PK `(workspace_id, user_id, game)` → `players`; `best integer`, `at timestamptz` | Members read. No one inserts or updates it directly. |
| `submit_score(workspace uuid, game text, score integer)` | Security definer, returns the stored best | Authenticated. It refuses a caller with no player row in the workspace, a game not in their `player_xp.unlocked`, and a score below 0 or above 9,999,999. It keeps the higher of the stored best and the score. |

- **Every grant is explicit.** New tables get no default grants (`auto_expose_new_tables = false`).
- **One row per login** found in the ledger, player or not, so a person who joins later already
  has their XP.
- **Level and unlocks are computed in JavaScript** and stored; SQL never repeats the rules.
- **The weekly backup includes scores.** `pnpm game:export` adds `arcade_scores`, because scores
  can't be rebuilt. `player_xp` is left out: it rebuilds from the ledger.

### The arcade

- **Reading.** The page reads the player's `player_xp` row (by lower-cased GitHub login) and the
  game's top five from `arcade_scores` (with the players' names and heroes) along with the galaxy,
  as the signed-in member.
  - **XP unreadable:** the arcade shows no level and never guesses one.
  - **No row:** the player has no XP yet.
- **Menu.** A **GAMES** item after HALL OF HEROES, shown to everyone signed in. Its hint reads
  "LV 3 · 1 game unlocked". A player's badge adds the level: `P1 INKY · OCTOPOD · LV 3`. It shows
  no level before the first point.
- **The game room** (a new `games` scene):
  - **Header:** the level and an XP bar, e.g. `LV 3 · 180 / 300 XP`, and "120 XP to LV 4".
  - **One cabinet per game in the registry:**
    - Unlocked: its title, the crew's top five with the player's own line highlighted, and "A · PLAY".
    - Locked: dark, showing "LV n".
    - Two dark SOON cabinets for the games still to come, with no level shown.
  - **States:**
    - A visitor sees every cabinet locked and "LINK GITHUB TO EARN XP".
    - A player with no row sees "NO XP YET · SCORE YOUR FIRST POINT".
    - An unreadable XP shows "XP OUT OF REACH".
  - **Layouts:** the wide grid shows the three cabinets side by side. The tall grid shows one per
    page, "PAGE n/N", turned with ◀ ▶.
- **Level up** (a new `levelup` scene):
  - **When:** on arriving at the menu, if the player's level is higher than the last one
    celebrated on this device, the level-up screen plays first.
  - **What it shows:** "LEVEL UP! LV n" with a fanfare, the hero at 2× and the new XP bar. When a
    game unlocked, it adds "NEW GAME UNLOCKED · ENTROPY INVADERS": A plays at once, B goes on to
    the menu.
  - **Memory:** the level celebrated is saved in browser storage under
    `omni-loop:level-seen:<login>`. A new device plays it once more.
  - **Never** on XP it could not read.
- **Entropy Invaders** (a new `invaders` scene):
  - **The defender.** The player's own hero, their OmniMan body in their fleet's colours
    (`heroLook()`), flies left and right along the ground and fires one plasma bolt at a time.
    It is a superhero, not a ship.
  - **The attackers.** A formation of alien Entropy (the `entropy` sprite, one wound kind per row)
    marches side to side, steps down at each edge and fires back.
    - Wide grid: 5 rows × 10.
    - Tall grid: 5 rows × 6.
    - Each alien pays its wound kind's close value from the rulebook (`woundClose`): top row beacon
      25, fault line 20, unconfirmed ground 15, zone under fire 10, bottom row transmission 5.
      An attract screen shows this score table.
  - **Shields and waves.** Shields (four wide, three tall) wear away under fire from both sides.
    Each cleared wave starts the next one faster.
  - **Lives and game over.** Three lives. The game is over at no lives, or when the formation
    reaches the hero's row. The score is then sent once through `submit_score()`, and "NEW BEST"
    shows when it is one. If sending fails, "SCORE NOT SAVED" shows and A retries once.
  - **Controls.** Hold ◀ ▶ to move and hold A to fire. START pauses, and B from the pause returns
    to the game room. The game pauses on its own when the tab is hidden or the window loses focus.
  - **Sound.** The existing synth: a marching bass that speeds up with the formation, fire, hit,
    hero hit, game over, and the level-up and unlock fanfares.
  - **Built as:** a pure, seeded engine, `apps/galaxy/src/arcade/games/invaders.ts`
    (`newGame()`, `step(state, held, dt)`, no DOM), drawn by the scene. A registry,
    `apps/galaxy/src/arcade/games/index.ts` (id, title, scene), lists the games; later PRDs
    extend it.
- **Held buttons.** A new input channel beside `act()`, in `apps/galaxy/src/arcade/held.ts`:
  - It keeps the set of held buttons from key down and key up, and from the pad's finger down, up
    and cancel.
  - Losing focus clears the set.
  - While a game runs, it drives the game and the D-pad's hold-to-repeat is off.
  - Menus keep `act()` unchanged.
- **How to play** gains a LEVELS section that reads the rulebook's `xp` block (what counts, the
  curve, the unlocks), so the rules shown never drift from the rules applied.
- **The demo and the single-file artifact:**
  - **XP:** computed in the browser by `experience()` from the demo events. The demo guest borrows
    the XP of the demo world's highest-XP contributor, so the room, the level-up and the game all
    show.
  - **High scores:** kept in browser storage behind the `Account` interface, which gains
    `submitScore()` and `scores()`.

## Decisions

| # | Decision | Why |
|---|---|---|
| D1 | This PRD holds the progression and the first game; each later game is a PRD of its own. The first point unlocks the first game. | A playable game at the end, with a review one plan can carry. (Asked; the person set the first-point rule.) |
| D2 | XP is every positive personal credit ever earned, across seasons. Reverts and clawbacks never subtract. | A level is never lost to a revert, as in an RPG. (Asked.) |
| D3 | The first game is Space Invaders style: Entropy Invaders. The defender is the player's own superhero, fighting alien Entropy; it is not a ship. | It fits the galaxy, and it is the easiest of the three to play on a D-pad and A. (Asked; the person corrected ship to superhero.) |
| D4 | High scores live in a shared crew table in Supabase, one best per player per game. | More social than a score kept on one device. (Asked; the person chose it over device-only.) |
| D5 | Blocked by #100. | #100 rebuilds `players` under a workspace; the new tables are born scoped instead of being rekeyed. (Asked.) |
| D6 | XP is written to `player_xp` by the game workflow on every poll, not derived in the arcade. | The stored row lets `submit_score()` check unlocks in the database, and the arcade reads one row. (Asked; the person chose it over deriving XP in the arcade.) |
| D7 | Every XP number lives in one rulebook block. Every poll recomputes all XP from the whole ledger with the rules of the day, and How to play reads the same block. | The rules must be easy to change later, from the ledger. (Asked: the person's own requirement.) |
| D8 | Unlocks only grow: a game once unlocked stays unlocked after a rule change. | A rule change should never take a game away from someone. (Asked.) |
| D9 | LV 1 at the first point, then 25·*n*·(*n*−1) XP, capped at LV 99. | LV 2 is five zones secured; later levels ask for real, lasting work. (Shown in the design; approved.) |
| D10 | GAMES shows to everyone signed in, and a visitor sees every cabinet locked. The SOON cabinets show no level. | Locked cabinets show what linking GitHub leads to. A level stays unset until its game's PRD sets it. (Shown in the drawn design; approved.) |
| D11 | The last level celebrated is kept in browser storage. | It is a per-device courtesy; losing it only replays a fanfare. (Shown in the design; approved.) |
| D12 | Each alien pays its wound kind's `woundClose` value. | Playing teaches what each kind of Entropy is worth. (Shown in the design; approved.) |
| D13 | `submit_score()` is the only write to `arcade_scores`. It checks the game is unlocked and caps the score at 9,999,999. | The database decides who may post a score. Scores come from the browser, so the cap keeps them sane. (Shown in the design; approved.) |
| D14 | `player_xp` has a row per login in the ledger, joined or not. | A person who joins later already has their XP. (Shown in the design; approved.) |
| D15 | The weekly backup exports `arcade_scores`, not `player_xp`. | Scores can't be rebuilt; XP can, from the ledger. (Shown in the design; approved.) |
| D16 | The demo guest borrows the XP of the demo world's highest-XP contributor. | Otherwise the demo and the single-file artifact would show every cabinet locked. (Not asked; the most reversible option, raised in the spec review.) |

## User stories

1. As a player who has just earned my first point, I open the arcade, see LEVEL UP! LV 1 and NEW
   GAME UNLOCKED: ENTROPY INVADERS, and play it at once.
2. As a player, I see my level on the menu badge, and in the game room my XP bar and how much XP
   the next level needs.
3. As a player, I fly my own hero against the alien Entropy from my laptop's keyboard or my
   phone's Game Boy pad.
4. As a player, my best score shows in the crew's top five on the cabinet, and a better game
   replaces it.
5. As a visitor, I see the game room with every cabinet locked, and learn that linking GitHub is
   how to earn XP.
6. As the person who owns the game's rules, I change a number in the rulebook's `xp` block and
   merge it. Every player's XP follows at the next poll, and How to play shows the new rules.
7. As a player, a rule change never takes away a game I already unlocked.
8. As a player in a new season, my level is still there; only the Hall of Heroes starts again.

## Scope

**In:**

- **Game layer:**
  - the `xp` block in `game/rulebook.mjs`
  - `game/experience.mjs`
  - `game/cli/xp.mjs` and the root script `game:xp`
  - the ledger job's new step in `.github/workflows/game.yml`
  - `arcade_scores` in `game:export`
  - `game/README.md`
- **Database:**
  - the migration: `player_xp`, `arcade_scores`, `submit_score()`, policies and grants
  - the new cases in `supabase/checks/access.sql`
  - the demo seed (`pnpm galaxy:seed`) writing the demo world's `player_xp` rows
- **Arcade:**
  - the GAMES menu item and the badge's level
  - the `games`, `levelup` and `invaders` scenes, each with a wide and a tall layout
  - the games registry and the invaders engine
  - `held.ts`
  - the sounds
  - How to play's LEVELS section
  - reading `player_xp` and `arcade_scores`
  - the `Account` interface's `submitScore()` and `scores()`, in the Supabase, demo and closed accounts
  - the demo guest's borrowed XP
  - the new scenes in `pnpm galaxy:shots`
  - `apps/galaxy/README.md`

**Out:**

- **Other games:** the maze game, the climber and the rest, each in its own PRD with its own
  unlock level.
- **Server-checked scores.** A score is what the browser sends, within the cap. No replay
  verification.
- **Rewards beyond games:** hero cosmetics, titles or badges unlocked by level.
- **Levels on other screens:** the Hall of Heroes, the fleets wall and the rankings page are
  unchanged.
- **Scoring:** points, seasons, rankings and every existing rulebook value.
- **Ledger events:** no new event type; the ledger is read, never written, by this PRD.

## Test seams

The testing playbook's rules apply: `pnpm test` runs vitest over `game/`, `packages/` and
`apps/*/src/`, tests sit beside their code, and no test calls GitHub or Supabase.

- **`game/experience.test.mjs`**, on hand-written ledger events:
  - one `ZONE_SECURED` gives 10 XP, and 15 at night
  - a cross-fleet wound close counts its multiplier
  - weights multiply, and a weight of 0 drops a kind
  - several seasons add up
  - a revert and a clawback leave XP unchanged; fleet credits give none
  - `levelFor` at 0, 1, 49, 50, 150 and 2,250 XP, and at the cap
  - `unlockedFor` adds to a stored list and never removes from it
  - every personal credit reason `score()` can emit maps to a weight key
- **`game/rulebook.test.mjs`:** the `xp` block is frozen, its curve strictly increases up to the
  cap, and every game in `unlocks` has a level between 1 and the cap.
- **`game/cli/xp.mjs`** exports its run with the REST client injected, tested against the fake
  PostgREST of `game/sources/supabase.test.mjs`:
  - it upserts every login in one call, lower-cased
  - it keeps stored unlocks when a lowered weight drops a level
  - a failed ledger read writes nothing and exits non-zero
- **`game/workflow.test.mjs`:** the ledger job runs `pnpm game:xp` as the step right after
  `pnpm game:project`, and the export lists `arcade_scores`.
- **`supabase/checks/access.sql`**, run by the supabase workflow on the pull request:
  - a member reads both tables, and a member of another workspace reads neither
  - an authenticated user can't insert or update either table
  - `submit_score()` refuses a visitor, a locked game, a negative score and one above 9,999,999
  - `submit_score()` keeps the higher of two scores
  - the service role writes `player_xp`
- **`apps/galaxy/src/arcade/games/invaders.test.ts`**, on the seeded engine, frame by frame:
  - holding a direction moves the hero, and only one bolt is in flight
  - a hit removes the alien and adds its kind's value, as passed in
  - the formation steps down at an edge
  - a cleared wave starts faster
  - a hit costs a life; no lives, or the formation reaching the hero's row, ends the game
  - a paused game does not change
  - the score never passes 9,999,999
- **`apps/galaxy/src/arcade/held.test.ts`:** down and up for keys and fingers, a cancelled finger
  releases, and losing focus clears everything.
- **The arcade's existing test files, extended:**
  - `grid.test.ts` lists `games`, `levelup` and `invaders` with both layouts
  - `menu.test.ts` shows GAMES to a visitor and to a player
  - the level-up rule plays for a higher level only, adds the unlock line only when a game
    unlocked, and never plays without XP
  - the demo account's `submitScore()` keeps the best
- **Manual:** `pnpm galaxy:shots` captures the three new scenes at its three sizes. A person plays
  one game on a laptop and one on a phone.

## Risks

- **What a merge publishes** (the releasing playbook):
  - the migration, applied to production Supabase by the supabase workflow (two tables and one
    function)
  - the ledger job's new step, which writes `player_xp` from the next poll where `GAME_ENABLED` is
    `true`
  - the arcade, on its Vercel project. The releasing playbook still has an open question on
    whether a merge deploys it.
- **Rollback:**
  - Revert the feature PR, then drop `submit_score()`, `arcade_scores` and `player_xp` in a
    follow-up migration.
  - Nothing is lost for XP: `player_xp` rebuilds from the ledger at the first poll after a
    re-release.
  - Scores come back from the weekly backup artifact (90 days).
- **Forged scores.** A player can post any score up to the cap through `submit_score()`. A score is
  a bragging right on its cabinet and never earns points or XP.
- **The game workflow off.** Where `GAME_ENABLED` is not `true`, no `player_xp` row exists, and
  every player sees "NO XP YET". Switching it on is `game/README.md` › Setup.
- **A rule change can lower XP and levels.** Unlocked games stay (D8). The person changing the
  rules owns telling the crew.
- **Cost.** `game:xp` reads the whole ledger on every poll, as `game:project` already does (a known
  limit in `game/README.md`); the cost grows with history.
- **Order with #141.** The design system renames `packages/sprites` to `packages/design`.
  Whichever of the two merges second moves its imports.

## Acceptance criteria

1. After `pnpm game:xp`, a login whose only credit is one zone secured in working hours has
   `xp = 10`, `level = 1` and `unlocked = {invaders}`.
2. XP counts positive personal credits across every season, each weighted by the `xp` block. A
   zone reverted, a clawback, a fleet credit or a game played leaves it unchanged.
3. `levelFor` gives no level at 0 XP, LV 1 at 1 and at 49, LV 2 at 50, LV 3 at 150 and LV 10 at
   2,250, and never passes the cap.
4. Changing a weight in the `xp` block changes every row's XP at the next run. A game already in
   `unlocked` stays there when the new rules lower the level.
5. When the ledger can't be read, `pnpm game:xp` writes nothing and exits non-zero.
6. Everyone signed in sees GAMES in the menu. A player with XP sees `LV n` on their badge, and
   never a level before the first point.
7. The game room shows the level, the XP bar and the XP to the next level. It shows the unlocked
   cabinet with the crew's top five, a locked cabinet with its level, and two SOON cabinets.
8. The game room shows "LINK GITHUB TO EARN XP" to a visitor, "NO XP YET · SCORE YOUR FIRST POINT"
   to a player with no row, and "XP OUT OF REACH" when XP can't be read.
9. The level-up screen plays once per new level on a device, before the menu. It shows NEW GAME
   UNLOCKED only when that level opened a game, and never plays without readable XP.
10. Entropy Invaders plays on the wide and tall grids, in the three forms, from the keyboard and
    from the pad.
11. In Entropy Invaders, each alien pays its wound kind's `woundClose` value. START and a hidden
    tab pause it, a player has three lives, and game over sends the score once.
12. `submit_score()` keeps the higher score. It refuses a visitor, a locked game, a score below 0
    or above 9,999,999, and another workspace. No player writes `player_xp` or `arcade_scores`
    directly.
13. `pnpm game:export` writes `arcade_scores`.
14. How to play has a LEVELS section whose numbers are the `xp` block's.
15. Season points, the Hall of Heroes, the fleets wall and the rankings are unchanged: their
    existing tests pass unmodified.
16. The demo and the single-file artifact show the game room with the demo guest's borrowed XP and
    play Entropy Invaders, with scores kept in browser storage.
