# Plan: OMNI KART gets options — keys, laps, the rivals' difficulty, the kart's colour and design — and a podium

PRD #1762, its spec beside this plan (`spec.md`). The feature branch `feat/kart-options` merges into
`main` with `Closes #1762`; each slice is a sub-PR from `feat/kart-options--<slice>` into the feature
branch, with `Part of #1762`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The OPTIONS screen and the player's keys: the options kept in the browser, KEYS, LAPS, DIFFICULTY and DEFAULTS, ▲ ▼ ◀ ▶ and SPACE by default during the countdown and the race, the hints that name them | `apps/galaxy/src/arcade/kart/options` `apps/galaxy/src/arcade/scenes/kart` `apps/galaxy/src/arcade/ArcadeApp.tsx` `apps/galaxy/src/arcade/held` `apps/galaxy/src/arcade/keys` | — | 1 |
| s2 | Three kart designs (CLASSIC, ROCKET, RACER) in the sprite library and the kart's eight colours | `packages/design/src/sprites` `apps/galaxy/src/arcade/kart/look` | — | 1 |
| s3 | The rivals' difficulty: EASY, NORMAL (today's numbers) and HARD, chosen when a race is made | `apps/galaxy/src/arcade/kart/rules.ts` `apps/galaxy/src/arcade/kart/rivals` `apps/galaxy/src/arcade/kart/items` `apps/galaxy/src/arcade/kart/race.ts` `apps/galaxy/src/arcade/kart/race.test.ts` | — | 1 |
| s4 | A SINGLE race runs the player's laps and difficulty, and the board gets the three-lap time | `apps/galaxy/src/arcade/kart/race.ts` `apps/galaxy/src/arcade/kart/race.test.ts` `apps/galaxy/src/arcade/kart/track` `apps/galaxy/src/arcade/kart/rivals` `apps/galaxy/src/arcade/scenes/kart` `apps/galaxy/src/arcade/ArcadeApp.tsx` | s1, s3 | 2 |
| s5 | The player's kart wears its look: the KART panel, the kart drawn on the track and the minimap | `apps/galaxy/src/arcade/kart/art` `apps/galaxy/src/arcade/kart/race.ts` `apps/galaxy/src/arcade/kart/race.test.ts` `apps/galaxy/src/arcade/kart/rivals` `apps/galaxy/src/arcade/scenes/kart` `apps/galaxy/src/arcade/ArcadeApp.tsx` | s2, s4 | 3 |
| s6 | MULTI: each player's look and the first arrival's laps travel on the grid, three laps whenever an entry carries none | `apps/galaxy/src/arcade/kart/net` `apps/galaxy/src/arcade/kart/grid` `apps/galaxy/src/arcade/kart/race.` `apps/galaxy/src/arcade/kart/hub` `apps/galaxy/src/arcade/kart/live` `apps/galaxy/src/arcade/scenes/kart` `apps/galaxy/src/arcade/ArcadeApp.tsx` | s5 | 4 |
| s7 | The PODIUM before the RESULTS, in SINGLE and MULTI, and OMNI KART's section of the README | `apps/galaxy/src/arcade/kart/podium` `apps/galaxy/src/arcade/kart/race.` `apps/galaxy/src/arcade/scenes/kart` `apps/galaxy/src/arcade/ArcadeApp.tsx` `apps/galaxy/README.md` | s6 | 5 |

**Shared ground.** Most of the slices meet in the same few files, so this plan builds them one wave after another:

- `apps/galaxy/src/arcade/kart/race.ts` and `race.test.ts` belong to s3, s4, s5, s6 and s7. In s6 and s7 they are covered by the `kart/race.` prefix, which also takes in `race.multi.test.ts`.
- `apps/galaxy/src/arcade/kart/rivals` belongs to s3, s4 and s5.
- `apps/galaxy/src/arcade/scenes/kart` (with `kart.test.ts` and `kart.hud.test.ts`) and `apps/galaxy/src/arcade/ArcadeApp.tsx` belong to s1, s4, s5, s6 and s7.

The blockers chain those slices s1/s3 → s4 → s5 → s6 → s7, so each one sits in a later wave than the slice before it. Wave 1 runs three slices side by side because their territories never meet: the screen and keys (s1), the sprites and palette (s2), and the engine's difficulty (s3).

Two tests outside every territory read what these slices change, and both must stay green without being edited:

- `games/stills.test.ts` imports `kart/art`, `kart/race` and `kart/track`. CLASSIC in FLEET colour stays today's kart, so the cabinet's still does not move.
- `kart/guard.test.ts` imports `ArcadeApp`, `scenes/kart`, `kart/art` and `kart/track`.

`apps/omni-app/api/` is built partly from `packages/design/`. It is a generated path, so it is never listed here.

## Per slice: done when

### s1: the OPTIONS screen and the player's keys

- `kart/options.ts` (pure):
  - The defaults are GAS ▲, BRAKE ▼, LEFT ◀, RIGHT ▶, ITEM SPACE, 3 laps, NORMAL, and a FLEET CLASSIC look.
  - A store that is missing, unreadable or not JSON reads as the defaults.
  - An invalid field falls back alone while the other fields are kept.
  - Two actions on one key, or a stored reserved key, put the keys back to their defaults.
  - Binding a key another action holds swaps the two.
  - ENTER, TAB, SHIFT, ESC, M and F are refused.
  - A letter is kept in lower case.
  - `options.test.ts` covers each of these.
- The ready screen lists SINGLE, MULTI and OPTIONS, and ▲ ▼ move the cursor over the three lines.
- OPTIONS opens a panel with KEYS ›, LAPS ◀ 3 ▶ (3, 5, 7), DIFFICULTY ◀ NORMAL ▶ (EASY, NORMAL, HARD) and DEFAULTS. B goes back.
- Every change is written at once under `omni-loop:kart-options`, inside a try/catch, and is there after a reload. A store that throws leaves the game playable with the defaults.
- KEYS works like this:
  - It lists the five actions.
  - A on an action shows `PRESS A KEY`, and the next key becomes that action's, with the swap rule above.
  - A reserved key shows `KEY USED BY THE ARCADE`.
  - ESC, or the screen's B button, cancels.
- During the countdown and the race, the player's keys drive the kart:
  - By default, ▲ accelerates and SPACE fires the item.
  - A, Z and K no longer accelerate, and B, X, J and ESC no longer fire.
  - ENTER and TAB keep the pause and the MULTI menu.
  - On every other screen, the arcade's keys hold.
  - A key held when the race ends does nothing on the next screen.
- The on-screen pad's A and B are unchanged.
- The countdown shows the player's keys, and the item panel names the ITEM key. This is tested in `keys.hints.test.ts` and the scene's tests.

### s2: three designs and eight colours

- `packages/design/src/sprites.ts` paints ROCKET and RACER, each with its `-left` and `-right` leaning frames. Every frame is 28×18 and uses the kart's materials (`W` body, `N` trim, `n` wheels, `L`, `R`).
- `sprites.test.ts` hashes the six new frames, and CLASSIC's hashes are unchanged.
- `kart/look.ts` (pure):
  - It lists eight colours (FLEET, RED, ORANGE, YELLOW, GREEN, CYAN, BLUE, PINK) and three designs (CLASSIC, ROCKET, RACER).
  - It gives the tint a look draws with: FLEET is exactly today's tint for a fleet colour.
  - It gives the sprite name of a design for each of the three views.
- In `look.test.ts`:
  - No colour equals a theme token's default.
  - FLEET plus CLASSIC gives today's sprite and tint.
  - An unknown colour or design reads as FLEET or CLASSIC.

### s3: the rivals' difficulty

- `RULES` gains a table for each level: the skill range, the rubber band, and how long a rival holds an item before using it. NORMAL holds today's numbers exactly, and a test compares it with them.
- `newRace` takes `difficulty`, NORMAL when it is not given, and the rivals are made from that level.
- `items.ts`'s `wantsToUse` reads the level.
- On seeds 1, 7 and 42, with no player input, the rivals finish without falling at every level.
- Their mean race time is longer on EASY than on NORMAL, and longer on NORMAL than on HARD.
- An EASY rival holds an item longer than a HARD one.
- At no level is a rival's own pace (before the rubber band) above the player's top speed.

### s4: a SINGLE race runs the player's laps and difficulty

- `newRace` takes `laps` (3, 5 or 7; 3 when not given):
  - The race ends when the player crosses the line at the end of that lap.
  - The final-lap event comes on that last lap.
  - The HUD counts `LAP n/laps`.
  - Rivals count the same laps.
- The time the race gives to send is the clock at the player's third crossing:
  - In a race of 3 laps, it equals today's race time.
  - In a race of 5 or 7, it is sent at the finish, the same as today (P-PRODUCT-54).
  - The results show it as `3-LAP TIME`, and the table keeps the whole race's times.
- The ready screen's line names the player's laps (`COMET RING · 5 LAPS`).
- A SINGLE race is made with the player's laps and difficulty from the options.
- A race left from the pause sends what it sends today.

### s5: the player's kart wears its look

- The OPTIONS panel gains KART ›, which opens a panel with:
  - the player's kart turning (still under reduced motion);
  - `COLOR ◀ FLEET ▶` and `DESIGN ◀ CLASSIC ▶`, each change kept at once;
  - DEFAULTS, which also resets the look.
- A race carries the player's look:
  - The player's kart is drawn with it on the track, in all three views and while it spins.
  - A `Driver` may carry a look, and a kart is drawn with it.
  - A driver without a look is drawn as today, so the SINGLE rivals keep their fleet colour and CLASSIC.
- On the minimap, another kart's dot is its kart's colour, and the player's own dot stays yellow.
- `art.test.ts` covers the player's look, a driver's look, and a driver without a look.
- `games/stills.test.ts` passes unchanged.

### s6: MULTI looks and laps

- The Presence entry gains an optional `look` and an optional `laps`, and the player's entry carries both.
- An entry without them is read: its kart is drawn as today, and it counts as a tab without `laps`.
- How many laps the grid will run:
  - It is the first arrival's `laps` when every entry carries `laps`, and 3 otherwise.
  - The grid's title says it (`GRID · 5 LAPS`).
  - The grid lists each player with their kart in its look.
- The `start` message carries `laps`, and a `start` without it races 3. Every player races the start's laps.
- A `state` message with 4 to 7 laps is read.
- Each player sends their three-lap time to the board. The places and the results stay by the whole race's time.
- On the in-memory hub (`hub.fake.ts`):
  - A grid of two new tabs runs the first arrival's 5 laps.
  - A grid with one old entry runs 3 laps.
  - A remote kart is drawn with its look.

### s7: the PODIUM

- `kart/podium.ts` (pure):
  - It turns the results into three steps (second, first, third) and the player's place when they are off the podium (`YOU 5TH`).
  - In MULTI, a step stays empty (`…`) until its driver crosses.
  - A player who is OUT never stands on a step.
  - `podium.test.ts` covers each of these.
- Crossing the line at the end of the last lap shows PODIUM before RESULTS:
  - It shows the steps with each driver and their kart in its look, under confetti that stays still under reduced motion.
  - A shows RESULTS, which are the same as today plus the `3-LAP TIME` line.
  - The time has already been sent at the finish.
- A race left before the line shows no podium.
- In MULTI, the podium fills as players cross.
- `apps/galaxy/README.md`'s OMNI KART section says what the options do, where they are kept, the three-lap time and the podium.
