# Game room: XP, levels and Entropy Invaders — plan

**PRD:** #160 · **Spec:** `spec.md`, beside this plan · **Feature branch:** `feat/game-room` →
`main` (`Closes #160`) · **Sub-PRs:** `feat/game-room--<slice>` → the feature branch
(`Part of #160`).

Any decision taken without asking is an outbox item: a medium one is adopted, and a person is informed.

**Built after #100.** This PRD is blocked by #100 (Workspaces), so every path below is the layout
#100 leaves behind:

- the game tables are scoped by `workspace_id` and read through `is_member()`
- `players` is keyed by `(workspace_id, user_id)`
- the game commands take `--workspace`
- `game.yml` sets `OMNI_LOOP_WORKSPACE`

If #100 lands a path or a name differently, the slice follows the code, and the drift is an outbox
item.

**The tracer is s1.** XP, levels and unlocks are computed from the ledger by the rulebook's `xp`
block and written to `player_xp` by `pnpm game:xp` on every poll, before any screen reads them.

The arcade then grows one screen at a time. Every slice that adds a scene or a flow step shares
`ArcadeApp.tsx`, the scene dispatcher and the grid list, so these slices take one wave each:

- **s2:** the game room and the menu's level
- **s3:** Entropy Invaders, playable
- **s5:** the crew high scores
- **s6:** the level-up moment

s4 (How to play's LEVELS section) touches none of that and runs beside s3. s7 closes with the
docs.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | XP from the ledger, recomputed every poll: the rulebook's `xp` block, `game/experience.mjs`, `pnpm game:xp` after `game:project` in the ledger job, and the `player_xp` table with its access checks | `game/rulebook.mjs` `game/rulebook.test.mjs` `game/experience` `game/cli/xp` `game/workflow.test.mjs` `.github/workflows/game.yml` `package.json` `supabase/migrations/` `supabase/checks/access.sql` `apps/galaxy/scripts/seed` `apps/galaxy/scripts/sql` `supabase/seed.sql` | — | 1 |
| s2 | The game room shows your level: GAMES in the menu, the level on the badge, the `games` scene on both grids with the registry's cabinets, the SOON cabinets and every XP state, the page reading `player_xp`, and the demo guest's borrowed XP | `apps/galaxy/src/arcade/games/` `apps/galaxy/src/arcade/scenes/games` `apps/galaxy/src/arcade/scenes/menu` `apps/galaxy/src/arcade/scenes/index` `apps/galaxy/src/arcade/scenes/common` `apps/galaxy/src/arcade/grid` `apps/galaxy/src/arcade/onboarding` `apps/galaxy/src/arcade/ArcadeApp.tsx` `apps/galaxy/src/arcade/ArcadeClient.tsx` `apps/galaxy/src/arcade/types.ts` `apps/galaxy/src/data/` `apps/galaxy/app/page.tsx` `apps/galaxy/artifact/entry.tsx` `packages/galaxy/src/` `apps/galaxy/scripts/shots.mjs` | s1 | 2 |
| s3 | Entropy Invaders, playable: the held-button channel, the seeded engine, the `invaders` scene on both grids, the pad's held controls, the sounds, the score table, and A on the unlocked cabinet starting a game that ends on its score | `apps/galaxy/src/arcade/games/` `apps/galaxy/src/arcade/held` `apps/galaxy/src/arcade/scenes/invaders` `apps/galaxy/src/arcade/scenes/games` `apps/galaxy/src/arcade/scenes/index` `apps/galaxy/src/arcade/scenes/common` `apps/galaxy/src/arcade/grid` `apps/galaxy/src/arcade/onboarding` `apps/galaxy/src/arcade/ArcadeApp.tsx` `apps/galaxy/src/arcade/Controls.tsx` `apps/galaxy/src/arcade/repeat` `apps/galaxy/src/arcade/sound.ts` `apps/galaxy/src/arcade/score` `apps/galaxy/scripts/shots.mjs` | s2 | 3 |
| s4 | How to play gains a LEVELS section that reads the rulebook's `xp` block: what counts, the curve and the unlocks | `apps/galaxy/src/arcade/scenes/menu` `packages/galaxy/src/` | s1 | 3 |
| s5 | The crew high scores: `arcade_scores` and `submit_score()` with their access checks, the `Account`'s `submitScore()` and `scores()`, the cabinet's top five, game over sending the score once, and `arcade_scores` in the weekly export | `supabase/migrations/` `supabase/checks/access.sql` `apps/galaxy/src/arcade/account-` `apps/galaxy/src/arcade/types.ts` `apps/galaxy/src/arcade/ArcadeApp.tsx` `apps/galaxy/src/arcade/ArcadeClient.tsx` `apps/galaxy/src/arcade/scenes/games` `apps/galaxy/src/arcade/scenes/invaders` `apps/galaxy/src/data/` `apps/galaxy/app/page.tsx` `game/cli/export.mjs` `game/workflow.test.mjs` | s1, s3 | 4 |
| s6 | The level-up moment: the `levelup` scene on both grids, played once per new level on this device before the menu, with NEW GAME UNLOCKED when a game opened | `apps/galaxy/src/arcade/levelup` `apps/galaxy/src/arcade/scenes/levelup` `apps/galaxy/src/arcade/scenes/index` `apps/galaxy/src/arcade/scenes/common` `apps/galaxy/src/arcade/grid` `apps/galaxy/src/arcade/onboarding` `apps/galaxy/src/arcade/ArcadeApp.tsx` `apps/galaxy/src/arcade/sound.ts` `apps/galaxy/src/arcade/score` `apps/galaxy/scripts/shots.mjs` | s2, s3 | 5 |
| s7 | The docs: `game/README.md` for `game:xp`, `player_xp` and the scores backup; `apps/galaxy/README.md` for the new screens, controls and tables | `game/README.md` `apps/galaxy/README.md` | s5, s6 | 6 |

**Shared ground.**

- `apps/galaxy/src/arcade/ArcadeApp.tsx`: s2, s3, s5 and s6 each wire a scene or a flow step there.
  They sit in waves 2, 3, 4 and 5, one each.
- `apps/galaxy/src/arcade/scenes/index`, `scenes/common`, `grid` and `onboarding`: s2, s3 and s6
  each add their scene to the dispatcher, the `SceneName` union, the grid's groups and the scenes
  a sign-in allows. Waves 2, 3 and 5.
- `apps/galaxy/scripts/shots.mjs`: s2, s3 and s6 each add their scenes to the screenshot walk.
  Waves 2, 3 and 5.
- `apps/galaxy/src/arcade/games/`: s2 creates the registry (`index.ts`), and s3 adds the engine
  and points the registry at its scene. Waves 2 and 3.
- `apps/galaxy/src/arcade/scenes/games`: s2 draws the room, s3 makes A start a game, and s5 fills
  the cabinet's top five. Waves 2, 3 and 4.
- `apps/galaxy/src/arcade/scenes/invaders`: s3 draws the game, and s5 sends the score at game over.
  Waves 3 and 4.
- `apps/galaxy/src/arcade/scenes/menu`: s2 adds GAMES and the badge's level, and s4 adds LEVELS to
  How to play. Waves 2 and 3.
- `packages/galaxy/src/`: s2 re-exports what the arcade needs from `game/experience.mjs`, and s4
  adds the `xp` block to the view's `rules`. Waves 2 and 3.
- `apps/galaxy/src/arcade/types.ts`, `ArcadeClient.tsx`, `apps/galaxy/src/data/` and
  `apps/galaxy/app/page.tsx`: s2 passes the player's XP, and s5 the scores. Waves 2 and 4.
- `apps/galaxy/src/arcade/sound.ts` and `apps/galaxy/src/arcade/score`: s3 adds the game's sounds,
  and s6 the fanfares. Waves 3 and 5.
- `supabase/migrations/` and `supabase/checks/access.sql`: s1 adds `player_xp`, and s5 adds
  `arcade_scores` and `submit_score()`, each in its own migration after #100's. Waves 1 and 4.
- `game/workflow.test.mjs`: s1 pins the `game:xp` step, and s5 the export's `arcade_scores`.
  Waves 1 and 4.

## Per slice: done when

**s1: XP from the ledger.**

- `game/rulebook.mjs` holds the `xp` block the spec sets out (weights, curve, cap, unlocks),
  frozen. Its test checks that the curve strictly increases up to the cap and that every unlock
  level is between 1 and the cap.
- `game/experience.mjs` passes its tests on hand-written events:
  - one zone secured in working hours gives 10 XP, and 15 at night
  - a cross-fleet wound close counts its multiplier
  - a weight of 0 drops a kind, and several seasons add up
  - a revert and a clawback leave XP unchanged, and fleet credits give none
  - `levelFor` gives no level at 0 XP, LV 1 at 1 and at 49, LV 2 at 50, LV 3 at 150, LV 10 at
    2,250, and stops at the cap
  - `unlockedFor` adds to a stored list and never removes from it
  - every personal credit reason `score()` emits maps to a weight key
- `pnpm game:xp`, run against the fake PostgREST:
  - it upserts every login in one request, lower-cased, with `xp`, `level`, `unlocked` and
    `computed_at`
  - a lowered weight keeps the stored unlocks
  - a failed ledger read writes nothing and exits non-zero
- `game.yml`'s ledger job runs `pnpm game:xp` as the step right after `pnpm game:project`, and
  `game/workflow.test.mjs` pins it.
- The migration creates `player_xp` with explicit grants. `supabase/checks/access.sql` shows:
  - a member reads it, and a member of another workspace does not
  - an authenticated user can't insert or update it
  - the service role writes it
- `pnpm galaxy:seed` writes the demo world's `player_xp` rows. `pnpm test` passes, and every
  existing economy and galaxy test passes unmodified.

**s2: the game room shows your level.**

- The menu shows GAMES after HALL OF HEROES to everyone signed in, and its hint names the level and
  the number of games unlocked. A player with XP sees `LV n` on their badge; there is no level
  before the first point.
- The `games` scene has a wide layout (three cabinets side by side) and a tall one (one cabinet a
  page, ◀ ▶), and `grid.test.ts` lists it. It shows:
  - the level, the XP bar and the XP to the next level
  - the Entropy Invaders cabinet, unlocked or locked with its level; its top five reads "NO
    SCORES YET" until s5
  - two SOON cabinets with no level
- The room shows "LINK GITHUB TO EARN XP" to a visitor, "NO XP YET · SCORE YOUR FIRST POINT" to a
  player with no row, and "XP OUT OF REACH" when `player_xp` can't be read. None of them shows a
  level.
- Signed in with Supabase, the page reads the player's `player_xp` row by lower-cased login.
- In the demo and the single-file artifact, the guest shows the XP of the demo world's highest-XP
  contributor, computed by `experience()`.
- `menu.test.ts` covers GAMES for a visitor and a player. `pnpm galaxy:shots` captures the room at
  its three sizes.

**s3: Entropy Invaders, playable.**

- `games/invaders.test.ts`, on the seeded engine, frame by frame:
  - holding a direction moves the hero, and only one bolt is in flight
  - a hit removes the alien and adds its kind's value as passed in
  - the formation steps down at an edge, and a cleared wave starts faster
  - a hit costs a life, and no lives or the formation reaching the hero's row ends the game
  - a paused game does not change
  - the score never passes 9,999,999
- `held.test.ts`: keys and fingers go down and up, a cancelled finger releases, and losing focus
  clears everything.
- The `invaders` scene has a wide layout (5 × 10, four shields) and a tall one (5 × 6, three
  shields), and `grid.test.ts` lists it.
  - The defender is the player's own hero in their fleet's colours; the attackers are the `entropy`
    sprite, one wound kind per row.
  - Each alien pays the view's `woundClose` value for its kind, and the score table shows them.
- A on the unlocked cabinet starts a game. It plays from the keyboard, and from the pad in the
  `handheld` and `advance` forms: hold ◀ ▶ and A, with several fingers at once, and no
  hold-to-repeat during a game.
- START pauses. B from the pause returns to the room. A hidden tab or a lost focus pauses the game.
- Game over shows the score and returns to the room. The sounds play, and M mutes them.
- `pnpm galaxy:shots` captures the game at its three sizes.

**s4: LEVELS in How to play.**

- The view's `rules` carry the `xp` block.
- How to play shows a LEVELS section with the weighted credits, the curve's first levels and each
  game's unlock level, all read from the rules. It is its own page on the tall grid and is laid
  out on the wide grid.
- A test changes a number in the rules and sees How to play show the new value.

**s5: the crew high scores.**

- The migration creates `arcade_scores` and `submit_score()`, with explicit grants.
  `supabase/checks/access.sql` shows:
  - a member reads the scores, and a member of another workspace does not
  - no authenticated user inserts or updates them directly
  - `submit_score()` refuses a visitor, a game not in the caller's `unlocked`, a score below 0 or
    above 9,999,999, and another workspace
  - `submit_score()` keeps the higher of two scores
- The `Account` interface has `submitScore()` and `scores()` in the Supabase, demo and closed
  accounts. The demo keeps the best in browser storage, tested.
- The unlocked cabinet shows the crew's top five with names, the player's own line highlighted.
- Game over sends the score once and shows "NEW BEST" when it is one. When sending fails it shows
  "SCORE NOT SAVED", and A retries once.
- `pnpm game:export` writes `arcade_scores.jsonl`, and `game/workflow.test.mjs` still pins the
  backup before the post.

**s6: the level-up moment.**

- A tested rule decides the level-up screen:
  - it plays when the player's level is higher than `omni-loop:level-seen:<login>` in browser
    storage, and never without readable XP
  - it shows NEW GAME UNLOCKED only when that level opened a game
- The `levelup` scene has a wide and a tall layout, and `grid.test.ts` lists it. It plays before
  the menu, with its fanfare:
  - A plays the unlocked game at once; B goes on to the menu
  - either key saves the level as seen, so the screen does not play again for that level on
    this device
- With reduced motion, its rays and flashes are still.
- `pnpm galaxy:shots` captures it at its three sizes.

**s7: the docs.**

- `game/README.md` describes:
  - `pnpm game:xp` and its place in the ledger job
  - the `xp` block and how to change the rules
  - `player_xp`
  - `arcade_scores` in the backup
  - the known limit that `game:xp` reads the whole ledger
- `apps/galaxy/README.md` describes:
  - the game room, the level-up and Entropy Invaders in the screens table, with the new scene
    count
  - the held controls
  - `player_xp`, `arcade_scores` and `submit_score()` in the database section
- The whole feature branch passes `pnpm test`. The Hall of Heroes, the fleets wall and the
  rankings tests pass unmodified.
