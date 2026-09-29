# Plan: five more fleet mascots

PRD #517, spec beside this plan (`spec.md`). The feature branch `feat/more-mascots` merges into
`main` through the feature PR, whose body says `Closes #517`. Each slice is a sub-PR from
`feat/more-mascots--<slice>` into the feature branch, whose body says `Part of #517`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | An owner can pick any of five new mascots, and the library and the database hold the same eleven keys. Covers: the sprites `atom-eve`, `shark`, `turtle`, `allen` and `robot` in `SPRITE_DEFS` (32×32, two frames, the looks of the spec's Decision 1); `MASCOTS` with the eleven keys in order; the new ramps in `forge.mjs` (shark blue-grey, turtle-shell olive, Allen's pale-blue skin) and nothing else changed there; the five digests pinned in `FORGED`; the parity test between `MASCOTS` and the newest `fleet_mascots()` migration, and the library test; a migration after `20261004090000_workspace_gate.sql` replacing `fleet_mascots()` with the eleven keys, headed with its PRD, proof and rollback; the new cases in `supabase/checks/fleets.sql`; BR-PRODUCT-46 restated with eleven keys | `packages/design/src/sprites` `packages/design/src/forge` `packages/design/src/mascots` `supabase/migrations/` `supabase/checks/fleets.sql` `.omni-loop/knowledge/product/rules.md` | — | 1 |
| s2 | A fleet flying a new mascot plays that mascot's own motif. Covers: five written motifs in the arcade's `MOTIFS` (`atom-eve` a sparkly rising shimmer, `shark` a low two-note swell, `turtle` three slow plods, `allen` a wobbly UFO warble, `robot` quick beeps and boops); `writtenMotif` tests for each | `apps/galaxy/src/arcade/sound` | — | 1 |

**Shared ground.** No prefix is declared by more than one slice. s1 owns the design package's sprite,
forge and mascot files, the database and the product rule. s2 owns only the arcade's sound files.
Wave 1 runs them together.

s2 needs nothing of s1. `writtenMotif` is keyed by the mascot string alone, and its tests name the
five keys directly. The sound test's check that a written motif's key is in `MASCOTS` covers the
existing mascots only, so it passes before s1 merges. Once both merge, the arcade draws each new
mascot and plays its motif.

## Per slice: done when

**s1**

- `SPRITE_DEFS` has `atom-eve`, `shark`, `turtle`, `allen` and `robot`. Each is 32×32, and its two
  frames show the change the spec's Decision 1 names.
- `MASCOTS` is `beaver, octopod, picsou, cia, pirate, invincible, atom-eve, shark, turtle, allen,
  robot`.
- Each new sprite passes the existing sprite cases: both frames from known colours only, over 8%
  filled, 32 wide, and at least 12 colours.
- `FORGED` pins the five new digests. Every digest already in `FORGED`, `FORGED_WOUNDED` and
  `FORGED_HEROES` passes unchanged.
- `forge.mjs` gains only the new ramps; no existing ramp or flat colour changes.
- The parity test:
  - passes when the newest migration defining `fleet_mascots()` lists the same keys, in the same
    order, as `MASCOTS`;
  - fails on inline SQL text missing one key.
- The library test:
  - `MASCOTS` has eleven unique keys;
  - each is a 32×32 sprite in `SPRITE_DEFS`;
  - none is `omni`, a hero, `entropy` or an icon.
- The new migration sorts after `20261004090000_workspace_gate.sql` and runs
  `create or replace function public.fleet_mascots()` with the eleven keys. Its header names PRD 517,
  `supabase/checks/fleets.sql` as its proof, and the rollback: a migration restoring the six keys.
- `supabase/checks/fleets.sql`:
  - `fleet_mascots()` returns the eleven keys in order;
  - `create_fleet` accepts and stores each of the five new keys;
  - `update_fleet` moves a fleet to `robot`;
  - `dragon` is still refused, naming the mascot field.
- The `supabase` workflow is green on the sub-PR.
- `apps/galaxy/src/fleets/render.test.ts` passes unchanged, now counting twelve mascot radios
  (None and eleven).
- BR-PRODUCT-46 names the eleven mascots in plain words.
- `pnpm test` is green.

**s2**

- `MOTIFS` in `apps/galaxy/src/arcade/sound.ts` has a motif for `atom-eve`, `shark`, `turtle`,
  `allen` and `robot`, each as the spec's Decision 6 describes.
- `writtenMotif` returns the mascot itself for each of the five keys, whatever the fleet's name.
- `writtenMotif` still returns null for `dragon` and for a fleet with no mascot.
- `invincible` still has no written motif.
- `pnpm test` is green.
