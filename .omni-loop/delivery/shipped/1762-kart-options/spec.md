---
prd: 1762
title: OMNI KART gets options — keys, laps, the rivals' difficulty, the kart's colour and design — and a podium
blocked-by: none
spec: file
---

# OMNI KART gets options — keys, laps, the rivals' difficulty, the kart's colour and design — and a podium

**Date:** 2026-10-12 · **PRD:** #1762
**Touches:**
- `apps/galaxy/src/arcade/kart/options.ts` (new, pure: the player's options, their defaults, reading
  them back field by field, and binding a key)
- `apps/galaxy/src/arcade/kart/look.ts` (new, pure: the kart's eight colours and three designs, and
  the tint and sprite a look draws with)
- `apps/galaxy/src/arcade/kart/podium.ts` (new, pure: the three steps and the player's place, from a
  race's results)
- `packages/design/src/sprites.ts` (two new kart designs, ROCKET and RACER, each with its two leaning
  frames)
- `apps/galaxy/src/arcade/kart/rules.ts`, `kart/rivals.ts`, `kart/items.ts` (the rivals' difficulty)
- `apps/galaxy/src/arcade/kart/race.ts`, `kart/track.ts` (the race's laps; the three-lap time; the
  podium's phase)
- `apps/galaxy/src/arcade/kart/net.ts`, `kart/grid.ts` (the look and the laps on the grid, the laps
  in the start message)
- `apps/galaxy/src/arcade/kart/art.ts` (each kart drawn with its look, on the track and on the
  minimap)
- `apps/galaxy/src/arcade/scenes/kart.ts`, `scenes/kart.tsx` (the OPTIONS screen, the hints that
  name the player's keys, the PODIUM screen)
- `apps/galaxy/src/arcade/ArcadeApp.tsx`, `held.ts` (the player's keys during a race; the options
  read and written in the browser)
- `apps/galaxy/README.md` (OMNI KART's section)

## Problem

OMNI KART is driven with keys nobody chose: A, Z, K or SPACE accelerates, B, X, J or ESC fires the
item, and ▲ does nothing, so a player who reaches for the arrows to drive does not move. Every race is
three laps against rivals of one strength, and every kart wears its driver's suit colour in the one
shape it has, so a player cannot make the race longer, easier or harder, or make their kart their
own. And a race ends on a table of names and times: nothing celebrates who won.

## Solution

### The OPTIONS screen

- **The ready screen gets a third line, OPTIONS,** under SINGLE and MULTI. It opens a panel:
  `KEYS ›`, `LAPS ◀ 3 ▶`, `DIFFICULTY ◀ NORMAL ▶`, `KART ›`, `DEFAULTS`. ▲ ▼ move the cursor, ◀ ▶
  change a value, A opens a line or presses DEFAULTS, B goes back to the ready screen.
- **Every change is kept at once** in the player's browser, under one key, `omni-loop:kart-options`,
  read and written inside a try/catch like `omni-loop:muted`. Nothing goes to the player's account:
  another device starts from the defaults.
- **DEFAULTS** puts every option back to its default: ▲ ▼ ◀ ▶ and SPACE, 3 laps, NORMAL, FLEET and
  CLASSIC.
- The screen speaks the arcade's language: English, in capitals.

### The keys

- **Five actions take one key each:** GAS (▲ by default), BRAKE (▼), LEFT (◀), RIGHT (▶) and ITEM
  (SPACE).
- **KEYS ›** lists them. A on an action shows `PRESS A KEY`; the next key pressed becomes that
  action's. A key another action holds swaps with it. ESC, or the screen's B button, cancels.
- **Six keys stay the arcade's** and cannot be bound: ENTER (start, pause, menu), TAB and SHIFT
  (select), ESC, M (mute) and F (fullscreen). Pressing one shows `KEY USED BY THE ARCADE`.
- A letter is kept in lower case and matches with or without SHIFT; keys are read as the keyboard
  types them (`e.key`), as the arcade reads them today, so an AZERTY player binds what they press.
- **The player's keys hold during the countdown and the race only.** The ready screen, the
  options, the pause, the MULTI menu, the podium and the results keep the arcade's keys. A key still
  held when the race ends does nothing on the next screen.
- **The on-screen pad does not change:** A accelerates and B fires the item on a phone, as today.
- **The screen names the player's keys:** the countdown shows a line with them
  (`▲ GAS ◀ ▶ STEER ▼ BRAKE SPACE ITEM`, with the player's own keys), and the item panel names the
  ITEM key.

### The laps

- **LAPS is 3, 5 or 7;** 3 by default.
- **The time sent to the board is always a three-lap time:** the clock as the player crosses the line
  at the end of their third lap. In a three-lap race it is the race time, as today; in a race of five
  or seven, the race goes on and the time sent is the one at the third crossing. The results say it:
  `3-LAP TIME 1:23.4`. The board keeps its rule (the lowest time is kept) and stays comparable.
- The HUD counts the race's laps (`LAP 4/5`), and its final lap is the race's last.

### The rivals' difficulty

- **DIFFICULTY is EASY, NORMAL or HARD;** NORMAL by default. It plays in SINGLE only, since MULTI
  has no rivals.
- **NORMAL is today's rivals,** every number unchanged.
- **EASY:** the rivals are slower, ease off more when they lead the player, and hold an item longer
  before they use it.
- **HARD:** the rivals drive up to the player's own top speed on a tighter line, and use an item
  sooner.
- No level makes a rival's own pace higher than the player's top speed, and at every level the
  rivals finish without falling. The difficulty never changes the player's kart, so the time sent
  stays fair.

### The kart's look

- **KART ›** opens a panel with the player's kart turning (still under reduced motion), and two
  lines: `COLOR ◀ FLEET ▶` and `DESIGN ◀ CLASSIC ▶`.
- **Eight colours:** FLEET (the colour karts wear today, the driver's suit), RED, ORANGE, YELLOW,
  GREEN, CYAN, BLUE and PINK. The seven are the kart's own literal colours, and none of them equals a
  workspace theme token (ADR-0046).
- **Three designs:** CLASSIC (today's kart), ROCKET and RACER. Each one keeps CLASSIC's 28×18 shape
  and its leaning frames, so a design changes how the kart looks and nothing about how it drives,
  collides or scales.
- The player's kart wears its look on the track, on the minimap (another player's dot is their
  kart's colour; the player's own dot stays yellow) and on the podium.
- The rivals in SINGLE keep their fleet's colour and CLASSIC.

### MULTI

- **Each player's look travels on the grid:** the Presence entry gains an optional `look`
  (`{ color, design }`, by their names). A player's kart is drawn with it on every screen; an entry
  without one draws today's kart.
- **The race runs the laps of the player who arrived first on the grid** (the first by arrival, the
  one who starts the race): the Presence entry gains an optional `laps`, the grid's line says it
  (`5 LAPS`), and the `start` message carries it.
- **More than three laps only when the whole grid can run them:** when any player's entry carries no
  `laps` (a tab opened before this change), the race runs 3 laps and the grid says `3 LAPS`. A
  `start` without `laps` is a three-lap race. A kart's `state` message counts up to 7 laps.
- A MULTI race sends each player's three-lap time to the board, as SINGLE does; its places and its
  results stay by the whole race's time.

### The PODIUM

- **When the player crosses the line at the end of the last lap,** a PODIUM screen shows before
  RESULTS: the first three on their steps (second, first, third), each with their driver and their
  kart in its look, under confetti (still under reduced motion), and, when the player is not on it,
  their place under the steps (`YOU 5TH`). A shows RESULTS, as they are today.
- **In SINGLE,** the steps are the results' first three places.
- **In MULTI,** a step whose driver has not crossed the line yet shows `…` and fills when they cross;
  a player who left is OUT and never stands on it.
- The time is sent at the finish, as today, never later for the podium (P-PRODUCT-54). A race left
  from the pause or the MULTI menu has no podium.

## Decisions

- **Split from a larger ask, chosen by the person:** the ask also held the circuit (fewer boxes, a
  softer tip-over, boost pads, shortcuts) and a space-station tunnel. The circuit's asks become their
  own PRD ("Piste vivante") and the tunnel another; this PRD carries the options and the podium only.
  The softer tip-over and the fewer boxes go with the circuit, chosen by the person over shipping
  them here.
- **The options live in the browser,** chosen by the person over a column on the player's account
  (a migration, a repository, the account demo) and over a split (keys in the browser, look on the
  account): keys belong to a keyboard, and the format can move to the account later without breaking
  anything.
- **One key per action, five actions, remapped freely,** chosen by the person over two keys per
  action and over presets only.
- **The player's keys hold in the countdown and the race only,** decided while designing: the menus
  keep one set of keys across every game of the arcade, and the arrows already move every cursor.
- **The touch pad does not change,** decided while designing: a D-pad cannot steer and press ▲ at
  once, so A stays the gas on a phone.
- **Eight colours and three designs, with FLEET and CLASSIC by default,** chosen by the person over a
  second trim colour and over a free colour picker: a fixed palette keeps the karts readable on the
  track, and the default keeps today's look.
- **Laps are 3, 5 or 7, and the board gets the three-lap time,** chosen by the person over 3 to 9 and
  over sending no time for a longer race.
- **EASY, NORMAL and HARD, with NORMAL as today,** chosen by the person over a fourth, EXPERT level
  and over a slider from 1 to 5.
- **In MULTI, the look is shared and the race runs the first arrival's laps,** chosen by the person
  over three fixed laps in MULTI and over a MULTI that stays as it is.
- **The podium shows before the results,** chosen by the person over one screen holding both and
  over a podium on the track in Mode 7.
- **The voice's objection, accepted.** persona:F-E Developer objected: "You are changing the messages
  of a live race. During a deploy, an old tab will ignore `laps` and run 3 laps while the others run
  5: exactly the bug in production I fear." Settled `accepted`: a race runs more than three laps only
  when every entry on the grid carries `laps`; otherwise it runs three, and a test races an old tab
  beside a new one (**MULTI**, **Test seams**).
- **No proof video,** chosen by the person.

## User stories

- As a racer on a keyboard, I drive with the arrows and fire my item with SPACE without setting
  anything.
- As a racer who prefers other keys, I open OPTIONS, bind GAS, BRAKE, LEFT, RIGHT and ITEM to keys
  of my own, and find them again the next time I play on this computer.
- As a racer, I pick 5 or 7 laps for a longer race, and still set a best time on the board.
- As a racer, I pick EASY to learn the circuit or HARD for a fight, against rivals that never fall.
- As a racer, I paint my kart in one of eight colours and pick one of three designs, and my
  colleagues see it in MULTI.
- As a player in MULTI, I see how many laps the race will run before it starts.
- As a racer, I see the first three on a podium when I cross the line, then the results.

## Scope

**In:**
- The OPTIONS line on the ready screen and its panels: KEYS, LAPS, DIFFICULTY, KART, DEFAULTS.
- The options kept in the browser, read back field by field.
- The player's keys during the countdown and the race; the hints that name them.
- The race's laps (3, 5 or 7), the three-lap time sent to the board, the HUD's lap count.
- The rivals' three levels of difficulty, in SINGLE.
- Eight colours and three kart designs, drawn on the track, the minimap and the podium; the two new
  designs in the sprite library.
- In MULTI: the look and the laps on the grid, the laps in the start message, three laps whenever an
  entry carries no `laps`, and a state message that counts up to 7.
- The PODIUM screen before RESULTS, in SINGLE and MULTI.
- OMNI KART's section of `apps/galaxy/README.md`.

**Out:**
- The circuit: fewer item boxes, a softer tip-over, boost pads and shortcuts (the PRD "Piste
  vivante", to come).
- A space-station tunnel (its own PRD, to come).
- Options kept on the player's account, or following them to another device.
- Remapping the on-screen pad, or the keys of the menus and of the other games.
- A look for the rivals in SINGLE, or a second colour on the kart.
- Other lap counts, a board per lap count, or any change to `submit_score()` or to the scores'
  table.
- A podium on the track in Mode 7.
- Any change to the cabinet's still: CLASSIC in FLEET colour is today's kart.

## Test seams

Every test is a Vitest test beside the module it tests; none calls GitHub or Supabase (`omni kb show
testing`). The new behaviour is written test-first.

- **`kart/options.test.ts`:** the defaults; an empty, unreadable or non-JSON store reads as the
  defaults; each invalid field falls back alone while the others are kept; two actions on one key, or
  a reserved key, put the keys back to their defaults; binding a free key, binding a key another
  action holds (the two swap), and refusing each of the six reserved keys; a letter kept in lower
  case.
- **`kart/look.test.ts`:** eight colours and three designs; no colour equals a theme token's default;
  FLEET draws exactly today's tint; CLASSIC is today's sprite.
- **`packages/design/src/sprites.test.ts`:** the hashes of ROCKET and RACER and their leaning frames,
  each 28×18; CLASSIC's hashes unchanged.
- **`kart/rivals.test.ts` and `kart/race.test.ts`:** NORMAL holds today's numbers exactly; on seeds
  1, 7 and 42, the rivals finish without falling at every level; their mean race time is longer on
  EASY than on NORMAL, and on NORMAL than on HARD; an EASY rival holds an item longer than a HARD
  one; no rival's own pace is above the player's top speed. A race of 5 and of 7 laps ends at its
  last lap, its final lap is the last one, and the time it gives to send is the one at the third
  crossing; a race of 3 laps gives today's time.
- **`kart/podium.test.ts`:** three steps from SINGLE results; the player's place under the steps when
  off the podium; in MULTI, an empty step until its driver crosses, then filled; a player OUT never
  on a step.
- **`kart/net.test.ts` and `kart/race.multi.test.ts`** (the objection's answer, on the in-memory hub
  `kart/hub.fake.ts`): an entry with no `look` and no `laps` is read; the grid's laps are the first
  arrival's; a grid holding one entry without `laps` runs 3 laps; a `start` without `laps` races 3; a
  `state` with 4 to 7 laps is read; a remote kart is drawn with its look.
- **`scenes/kart.test.ts` and `keys.hints.test.ts`:** the OPTIONS line and its panels move, change
  and keep every option; DEFAULTS; the player's keys drive the race and the countdown and do nothing
  on the menus, the pause, the podium and the results; ▲ accelerates and SPACE fires the item by
  default; Z and B no longer do in a race; the on-screen pad's A and B are unchanged; the countdown
  and the item panel name the player's keys; the PODIUM shows before RESULTS and A moves on.
- **`kart/art.test.ts`:** the player's kart and a remote kart drawn with their look; another
  player's minimap dot in their kart's colour, the player's own still yellow.
- **Guards that must stay green:** `kart/guard.test.ts` (nothing outside `arcade/kart/` imports it at
  run time), `arcade/theme.test.ts` (no scene writes a token's default), `games/stills.test.ts` (the
  cabinet's still unchanged) and the layering check.

## Risks

**What merging publishes** (`omni kb show releasing`): the arcade's new code ships with the galaxy
app's deploy. No migration, no change to `submit_score()`, to the scores' table or to the kart grid's
Realtime policies (they gate who joins the topic, never what a message holds).

- **Everyone's keys change.** ▲ now accelerates and SPACE fires the item; A, Z and K no longer
  accelerate in a race, and B, X, J and ESC no longer fire. A player used to the old keys finds the
  new ones named on the countdown, and can bind the old ones back in OPTIONS.
- **The deployment window.** A tab opened before the deploy keeps today's keys, laps and look until
  it reloads. In MULTI, an old tab reads a new entry without its `look` and `laps` (unknown fields are
  dropped), so it draws today's kart; a grid holding an old tab runs 3 laps, the objection's answer.
- **The board.** A longer race sends its three-lap time, which a player can only set while racing
  on; a time on the board stays a three-lap time.
- **Difficulty.** EASY and HARD are tuned rivals; the tests hold that they never fall and stay under
  the player's top speed on three seeds.

**Rollback:** revert the feature PR. The options left in a browser's storage are then never read.

## Acceptance criteria

1. The ready screen lists SINGLE, MULTI and OPTIONS; OPTIONS opens a panel with KEYS, LAPS,
   DIFFICULTY, KART and DEFAULTS, and B goes back to the ready screen.
2. With no options kept, a race drives with ▲ (gas), ▼ (brake), ◀ ▶ (steer) and SPACE (item); in a
   race, Z, K and A no longer accelerate and B, X, J and ESC no longer fire the item.
3. In KEYS, the player binds any of GAS, BRAKE, LEFT, RIGHT and ITEM to a key; a key another action
   holds swaps with it; ENTER, TAB, SHIFT, ESC, M and F are refused with `KEY USED BY THE ARCADE`;
   ESC cancels.
4. The player's keys act during the countdown and the race only; the menus, the pause, the podium
   and the results keep the arcade's keys, and the on-screen pad keeps A for the gas and B for the
   item.
5. The countdown names the player's keys, and the item panel names the ITEM key.
6. Every option is kept in the browser as soon as it changes and is there after a reload; a store
   that is missing, unreadable or invalid in one field gives the defaults for what it cannot read,
   and the game plays.
7. LAPS is 3, 5 or 7; the race runs that many laps and the HUD counts them; the time sent to the
   board is the clock at the player's third crossing of the line, shown as `3-LAP TIME`.
8. DIFFICULTY is EASY, NORMAL or HARD; NORMAL's rivals are today's; on seeds 1, 7 and 42 the rivals
   finish without falling at every level, slower on EASY and faster on HARD than on NORMAL, never
   above the player's top speed by their own pace.
9. KART shows the player's kart turning and offers eight colours and three designs, FLEET and CLASSIC
   by default; every design keeps today's size, and the kart drives the same whatever its look.
10. The player's kart wears its look on the track and on the podium; another player's minimap dot is
    their kart's colour while the player's own stays yellow; no kart colour equals a workspace theme
    token.
11. In MULTI, every player's kart is drawn with their look; an entry without one is drawn as today.
12. In MULTI, the grid says how many laps the race will run: the first arrival's, or 3 whenever a
    player's entry carries no laps; the race runs that many.
13. Crossing the line at the end of the last lap shows the PODIUM: the first three on their steps
    with their driver and kart, the player's place under them when not on it, and in MULTI a `…`
    step until its driver crosses; A shows RESULTS. A race left before the line shows no podium.
14. Nothing outside `arcade/kart/` imports it at run time, and the cabinet's still is unchanged.
