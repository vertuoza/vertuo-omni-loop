# Plan: your own fleets, or none

PRD #400, spec beside this plan (`spec.md`). The feature branch `feat/own-fleets` merges into `main`
through the feature PR, whose body says `Closes #400`. Each slice is a sub-PR from
`feat/own-fleets--<slice>` into the feature branch, whose body says `Part of #400`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The workspace's owner, and only the owner, writes its fleets. Covers: the migration `20261003090000_own_fleets.sql` (`is_owner(workspace)`; `create_fleet`, `update_fleet`, `retire_fleet`, `restore_fleet`, security definer, run as the signed-in person, owner only, validating label 1–12, `#rrggbb`, motto ≤ 60, a known mascot key or none, at most 12 active, `name` derived from the label and unique, never changed, never deleted; `vertuoza`'s owner set to the member whose GitHub login is `pierrederval`; the `teams` and `players` comments); `supabase/checks/fleets.sql`, run by the `supabase` workflow | `supabase/migrations/20261003090000_` `supabase/checks/fleets.sql` `.github/workflows/supabase.yml` | — | 1 |
| s2 | A player can play with no fleet. Covers: the fleet step offering the workspace's active fleets and PLAY SOLO, and skipped when there are none; a player row with no team (`lockIn`); `isReady`, `afterGate` and `nextStep` for fleets-and-a-pick, fleets-and-solo, and no fleets; the menu (MY HERO for anyone with a player row, JOIN A FLEET for a solo player, hidden with no fleets); the "NO FLEETS YET — RAISE YOUR OWN!" screen with the mascot parade, the owner's `/app/fleets` pointer (the viewer's role read with the arcade's data) and a member's "ASK YOUR OWNER"; SOLO instead of UNCREWED; the fleets wall, TOP FLEETS and the Hall of Heroes' fleet column hidden with zero fleets; the attract line counting the real fleets | `apps/galaxy/src/arcade/onboarding` `apps/galaxy/src/arcade/ArcadeApp.tsx` `apps/galaxy/src/arcade/fleets` `apps/galaxy/src/arcade/scenes/` `apps/galaxy/src/data/arcade` | — | 1 |
| s5 | The dashboard reads well for a solo player and a workspace with no fleets. Covers: "Fleets · season" hidden with no fleets; SOLO for a solo player; the "Join a fleet" copy; the dashboard's demo without a Vertuoza fleet | `apps/galaxy/src/dashboard/` | — | 1 |
| s3 | The owner manages the workspace's fleets on `/app/fleets`. Covers: the page in the app's shared top bar; the owner's view (New fleet with label, colour swatches or hex, motto, mascot grid or none, a live card preview; Edit; Retire confirmed on the page; retired fleets under a fold with Restore) calling s1's functions; a member's read-only view with "Only @owner can change fleets."; each refusal shown next to its field; the **Fleets** card on `/app` | `apps/galaxy/app/app/fleets/` `apps/galaxy/src/fleets/` `apps/galaxy/src/dashboard/Cards.tsx` | s1, s5 | 2 |
| s4 | Nothing of Vertuoza's fleets is left in code. Covers: the demo world without Vertuoza's fleets (`packages/galaxy`'s demo, `demoFleets()`), the signed-out attract mode showing s2's tagline and parade; a signed-in read failure showing an error, never demo fleets; flavour keyed by mascot instead of fleet name (HOME's card rules, the sound motifs, the sprite lookup, the design catalogue, the seed script, the artifact entry); the source scan | `packages/galaxy/src/` `packages/design/src/sprites` `packages/design/README.md` `apps/galaxy/src/data/load-galaxy` `apps/galaxy/src/data/arcade` `apps/galaxy/src/arcade/sound` `apps/galaxy/src/arcade/scenes/attract` `apps/galaxy/src/home/` `apps/galaxy/src/design/catalogue` `apps/galaxy/scripts/seed.mjs` `apps/galaxy/app/play/` `apps/galaxy/artifact/` `apps/galaxy/src/no-vertuoza-fleets.test.ts` `apps/galaxy/README.md` | s2, s5 | 2 |

**Shared ground.** Four prefixes are declared by more than one slice, and the waves keep them
apart:

- `apps/galaxy/src/data/arcade`: s2 (the viewer's role, the empty fleet list) in wave 1, and s4 (no
  demo fleets on a failed read) in wave 2.
- `apps/galaxy/src/arcade/scenes/attract`: s2 (the attract line's real count, inside `scenes/`) in
  wave 1, and s4 (the signed-out tagline and parade) in wave 2.
- `apps/galaxy/src/dashboard/Cards.tsx`: s5 (inside `dashboard/`) in wave 1, and s3 (the Fleets
  card) in wave 2.
- s3 and s4 share nothing, so wave 2 runs them together.

Wave 1 runs s1, s2 and s5 together: the database, the arcade and the dashboard own disjoint files.
s2 needs nothing of s1, because the database already allows a player with no team.

The ordering has reasons behind it:

- s3 follows s1: it calls the fleet functions. It follows s5 because both touch `Cards.tsx`.
- s4 follows s2: the signed-out attract mode reuses s2's tagline and parade, and both touch
  `data/arcade`. It follows s5 so its source scan runs over the dashboard's cleaned demo.

## Per slice: done when

**s1**

- `supabase/checks/fleets.sql` passes in the `supabase` workflow and proves:
  - the owner creates, updates, retires and restores a fleet;
  - a member, a member of another workspace and `anon` are refused each function (acceptance
    criteria 3, 4);
  - a label of 0 or 13 characters, a colour that is not hex, a motto of 61 characters, an unknown
    mascot and a 13th active fleet are each refused with a message naming the field (acceptance
    criterion 5);
  - `name` is derived from the label, unique in its workspace, and unchanged by an update;
  - `authenticated` still cannot insert, update or delete `teams` directly;
  - `vertuoza`'s owner is the member whose GitHub login is `pierrederval`, when that member exists
    (acceptance criterion 10).

**s2**

- The onboarding tests:
  - with no fleets, the steps go intro → name → hero → ready, and the player row has no team
    (acceptance criterion 1);
  - with fleets, the fleet step offers each active fleet and PLAY SOLO, and picking solo makes a
    player with no team (acceptance criterion 2);
  - `isReady` is true for a solo player.
- The menu tests show MY HERO for a solo player, JOIN A FLEET for a solo player when fleets exist,
  and neither fleet item with no fleets.
- The screen tests show the "raise your own" screen and the parade, with the owner's pointer and a
  member's "ASK YOUR OWNER" (acceptance criterion 6).
- SOLO appears, never UNCREWED, for a player.
- The fleets wall, TOP FLEETS and the fleet column are hidden with zero fleets (acceptance
  criterion 8).
- The attract line counts the real fleets, or is gone with none.

**s5**

- The dashboard tests hide "Fleets · season" with no fleets, show SOLO for a solo player, and no
  longer tell a member to join a fleet to play.
- The dashboard's demo names no Vertuoza fleet.

**s3**

- The page tests cover:
  - the owner's view: the form, the live preview, edit, retire with its on-page confirmation, and
    restore under the fold;
  - a member's read-only view, with "Only @owner can change fleets." (acceptance criteria 3, 4);
  - each refusal from s1's functions shown next to its field (acceptance criterion 5).
- The Fleets card on `/app` links to `/app/fleets`.

**s4**

- `apps/galaxy/src/no-vertuoza-fleets.test.ts` fails on either of these outside
  `supabase/migrations/`, `supabase/seed.sql` and the tests (acceptance criterion 9):
  - `pirates`, `cia` or `invincible-team`;
  - a fleet-name-keyed lookup.
- Signed out, the attract mode shows the tagline and parade, and no Vertuoza fleet (acceptance
  criterion 7).
- A signed-in read failure shows an error, never demo fleets.
- A fleet with the beaver mascot gets the beaver motif and card rule, whatever its name.
