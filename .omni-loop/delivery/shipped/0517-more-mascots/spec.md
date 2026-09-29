---
prd: 517
title: Five more fleet mascots
blocked-by: none
spec: file
---

# Five more fleet mascots

**Date:** 2026-09-29 · **PRD:** #517 · **Touches:** `packages/design` (the sprite set and the forge's
ramps), `supabase/migrations` and `supabase/checks/fleets.sql` (`fleet_mascots()`), `apps/galaxy`
(the arcade's sound motifs) · **Builds on:** #400 (your own fleets, or none)

## Problem

Since #400, every workspace raises its own fleets, and a fleet's owner picks its mascot from the
sprite set's mascot library. That library has six mascots (`beaver`, `octopod`, `picsou`, `cia`,
`pirate` and `invincible`), each drawn for one of Vertuoza's fleets. A workspace outside Vertuoza
with more than a handful of fleets runs out of distinct mascots and must reuse one, or draw a fleet
as a plain hero in its colour. Nothing in the library was drawn for anyone but Vertuoza.

## Solution

Five new mascots join the library, so an owner picks from eleven:

```
MASCOTS (@omni/design)      beaver  octopod  picsou  cia  pirate  invincible │ atom-eve  shark  turtle  allen  robot
fleet_mascots() (database)  the same eleven keys, by a new migration          │  ▲ new
                                   │
    ┌──────────────────────────────┼─────────────────────────────┐
    ▼                              ▼                             ▼
/app/fleets picker          the arcade (fleet step, wall,   "raise your own" parade,
(None + 11 mascots)          cards, a motif per mascot)      the design catalogue
```

Every screen that shows mascots already reads the library, so the new sprites appear there without
screen code. The owner's picker lists what `fleet_mascots()` returns, so it offers the new mascots
as soon as the migration runs.

## Decisions

1. **Five new mascots, appended after the existing six** in this order: `atom-eve`, `shark`,
   `turtle`, `allen`, `robot`. The key is what the owner's picker shows under each sprite, as it
   does for the existing six.

   | key | the look | its second frame |
   |---|---|---|
   | `atom-eve` | Atom Eve: a pink bodysuit with magenta trim, long red hair, a light pink atom on the chest, one hand raised holding a pink energy ball | the energy ball flickers and sparks move |
   | `shark` | an upright blue-grey shark: a white belly, a dorsal fin, fins for arms, a toothy grin, the four Vertuoza stripes on a collar with a navy tie | the tail swishes and the jaw opens wider |
   | `turtle` | a green turtle with an olive hex-patterned shell, its head out front, a bandana in the Vertuoza stripes | the head bobs up and the eye blinks |
   | `allen` | Allen the Alien: a wide round pale-blue head with one big green-irised eye, a green suit with white chest bands | he blinks and hovers one pixel higher, with a shadow below |
   | `robot` | a boxy retro steel robot: an antenna with a red light, cyan eyes behind a dark visor, a mouth grille, the four stripes on a chest panel, rivets | the antenna light blinks and the eyes brighten |

   `atom-eve` and `allen` are homages to the Invincible universe, in the same vein as the
   `invincible` mascot and OmniMan himself. `robot` is a generic retro robot, not a known character.
   The drafts on the before/after page show the intent. The drawn sprites may refine them, but keep
   each look in this table.

2. **Drawn to the library's standard:** each is 32×32 with two frames, drawn from materials the
   forge knows. Each forges at least 12 distinct colours and covers more than 8% of its frame, as
   the existing sprite tests require of every mascot.

3. **New colour ramps only where no existing ramp fits.** Three are expected: shark blue-grey,
   turtle-shell olive and Allen's pale-blue skin. Each is a 4-tone ramp (light, base, shade, dark)
   added to `RAMPS` in `forge.mjs`. Everything else uses the existing ramps and flat colours (pink `M`
   and plasma `P` for Eve, steel `L`, agent `A` and cyan `C` for the robot, terraform green `g` for
   the turtle's skin and Allen's suit). Adding ramps changes no existing sprite: every existing
   sprite, hero and wounded Entropy forges pixel-identical to before, as the pinned digests prove.

4. **The database accepts them through one new migration.** It runs
   `create or replace function public.fleet_mascots()` and returns the eleven keys in the library's
   order. `fleet_look()` already reads `fleet_mascots()`, so `create_fleet` and `update_fleet`
   accept the new keys with no other change. `dragon`, `entropy`, `omni` and the fleet-only names
   stay refused.

5. **The two lists cannot drift.** A test reads the newest migration under `supabase/migrations/`
   that defines `fleet_mascots()`. It fails when that migration's keys differ from `MASCOTS`, in
   content or in order. This replaces the comment in `sprites.mjs` that asks for the two lists to
   be kept in step.

6. **Each new mascot has its own sound.** A fleet flying one plays that mascot's motif when the
   arcade cursor lands on it, never three notes worked out from its name:
   - `atom-eve`: a sparkly rising shimmer
   - `shark`: a low two-note "dun-dun" swell
   - `turtle`: three slow, steady plods
   - `allen`: a wobbly UFO warble
   - `robot`: quick beeps and boops

   `invincible` keeps playing notes from its name, as today.

7. **Trading cards do not change.** There are five scoring values and five mascots already have one.
   A card for a new mascot takes the next value in turn, as `invincible` does today.

8. **The product rule is restated.** BR-PRODUCT-46 ("one of six keys") is rewritten to name the
   eleven keys in plain words, in the same slice as the migration.

9. **Nothing else changes.** Vertuoza's fleets, the demo world, the fleet step, scoring and the
   limit of 12 active fleets per workspace stay as they are. There are no uploads, and no new card
   values.

## User stories

1. As the owner of a workspace outside Vertuoza, I open `/app/fleets` and pick a shark, a turtle,
   Atom Eve, Allen or a robot for a fleet, and see it on its card as I choose.
2. As a player, I find my fleet on the arcade's fleet step, the fleets wall and the Hall of Heroes
   drawn as its new mascot, and I hear its own motif when the cursor lands on it.
3. As a visitor to a workspace with no fleets, I see all eleven mascots march in the "raise your
   own" parade.

## Scope

**In:**

- `packages/design/src/sprites.mjs`: the five sprites in `SPRITE_DEFS`, and `MASCOTS` with eleven
  keys.
- `packages/design/src/forge.mjs`: the new ramps.
- `packages/design/src/sprites.test.mjs`: the new pinned digests.
- The parity test between `MASCOTS` and `fleet_mascots()`.
- A migration after `20261004090000_workspace_gate.sql` that replaces `fleet_mascots()` with the
  eleven keys, headed with its PRD, its proof and its rollback, as the other migrations are.
- `supabase/checks/fleets.sql`: cases for the new keys.
- `apps/galaxy/src/arcade/sound.ts`: the five motifs, and their tests.
- BR-PRODUCT-46 in `.omni-loop/knowledge/product/rules.md`.

**Out:**

- Mascots for Vertuoza's own fleets.
- Uploading a mascot.
- A display name for a mascot other than its key.
- New trading-card values.
- Any change to scoring or to the fleet step.

## Test seams

Tests sit beside the code (`*.test.mjs` in `packages/`, `*.test.ts` under `apps/galaxy/src/`) and run
with `pnpm test`. SQL checks are under `supabase/checks/`, and the `supabase` workflow runs them on
every pull request. No test calls GitHub or Supabase.

- **The sprites (`packages/design/src/sprites.test.mjs`):**
  - The existing cases cover each new sprite as soon as it is in `SPRITE_DEFS` and `MASCOTS`: both
    frames from known colours only, over 8% filled, 32 wide, and at least 12 colours.
  - The five new sprites are pinned in `FORGED` as first drawn.
  - Every digest already pinned stays unchanged.
- **Parity:** a unit test fails when the newest `fleet_mascots()` migration and `MASCOTS` list
  different keys or a different order. It has one case proving it catches a missing key, run on
  inline SQL text.
- **The library:** `MASCOTS` holds eleven unique keys. Each is a 32×32 sprite in `SPRITE_DEFS`, and
  none is `omni`, a hero, `entropy` or an icon.
- **Sounds (`apps/galaxy/src/arcade/sound.test.ts`):** `writtenMotif` returns the mascot itself for
  each of the five new keys, whatever the fleet's name, and still returns null for `dragon`.
- **The picker (`apps/galaxy/src/fleets/render.test.ts`):** the existing count of mascot radios
  (`MASCOTS.length + 1`) now proves twelve, including None.
- **The database (`supabase/checks/fleets.sql`):**
  - `fleet_mascots()` returns the eleven keys in order.
  - `create_fleet` accepts each new key and stores it.
  - `update_fleet` moves a fleet to `robot`.
  - `dragon` is still refused, naming the mascot field.

## Risks

A merge to `main` applies the migration to the production Supabase project and deploys galaxy.
Owners can then pick the five new mascots. Existing fleets, players and ledger events are untouched,
and the game's economy does not change.

The picker offers what the database returns, so until the migration has run it offers the six it
knows. No owner is shown a mascot that would be refused.

**Rollback:** revert the feature PR, and add a follow-up migration that restores the six-key
`fleet_mascots()`. A fleet that picked a new mascot in the meantime keeps its key. Once the sprite is
gone, `fleetSprite()` draws that fleet as a hero in its colour, so nothing breaks, and its owner can
pick another mascot.

## Acceptance criteria

1. On `/app/fleets`, the owner's mascot picker offers None and eleven mascots in the library's order.
   Each of the five new ones shows its sprite and its key.
2. An owner creates a fleet with each new mascot. It is stored with that key, and the arcade's fleet
   step and fleets wall draw it as that mascot.
3. `fleet_mascots()` returns `beaver, octopod, picsou, cia, pirate, invincible, atom-eve, shark,
   turtle, allen, robot`. A fleet with the mascot `dragon` is still refused, with a message naming
   the mascot field.
4. With no fleets, the "raise your own" parade shows all eleven mascots.
5. Each new mascot animates between two frames showing the change its row in Decision 1 names.
6. When the arcade cursor lands on a fleet with a new mascot, it plays that mascot's own motif.
7. Every sprite that existed before this PRD forges pixel-identical to before: all pinned digests
   pass unchanged.
8. The parity test fails if `MASCOTS` and the newest `fleet_mascots()` migration list different keys.
9. Vertuoza's fleets and the demo world are unchanged.
