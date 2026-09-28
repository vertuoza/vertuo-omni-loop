---
prd: 400
title: Your own fleets, or none
blocked-by: none
spec: file
---

# Your own fleets, or none

**Date:** 2026-09-28 · **PRD:** #400 · **Touches:** `supabase/migrations` (fleet functions, the owner
helper, Vertuoza's owner), `apps/galaxy` (the arcade's onboarding and fleet screens, a new
`/app/fleets` page, the dashboard), `packages/galaxy` and `packages/design` (demo and mascot data) ·
**Builds on:** #359 (sign-up with GitHub)

## Problem

Since #359 anyone can sign up, but fleets are still Vertuoza's:

- A workspace made by sign-up has no fleet, and the arcade cannot go on without one. The player row
  is only created when a fleet is locked in (`lockIn` in `apps/galaxy/src/arcade/ArcadeApp.tsx`),
  `isReady()` in `apps/galaxy/src/arcade/onboarding.ts` needs an active fleet, and the fleet step
  shows **NO FLEETS YET** with no way forward (`apps/galaxy/src/arcade/scenes/recruit.tsx`).
- Fleets are created only by a migration. Only the service role may write `public.teams`, and nothing
  lets a workspace manage its own. `workspace_members.role` exists, but nothing reads it.
- Vertuoza's six fleets are written into code as the demo world (`packages/galaxy/src/demo.mjs`,
  `demoFleets()` in `apps/galaxy/src/data/load-galaxy.ts`). A signed-out visitor, or a workspace
  whose read fails, sees them. Some flavour is keyed by Vertuoza's fleet names (HOME's card rules,
  the arcade's sound motifs, `FLEET_SPRITE`), and the attract mode says "FIVE FLEETS. ONE COMMANDER."
- With zero fleets, several screens show empty headings or "UNCREWED" (the fleets wall, TOP FLEETS,
  the Hall of Heroes, the menu hint, the dashboard's "Fleets · season").

The database already allows a player with no fleet: `players.team` is nullable, and
`players_guard()` accepts null.

## Solution

Fleets become optional, and each workspace's own:

```
arcade:   intro ──▶ fleet step ──▶ name ──▶ hero ──▶ ready
                     │  the workspace has fleets: its fleets + PLAY SOLO
                     └  it has none: skipped

/app/fleets (owner):  New fleet · Edit · Retire · Restore   ──▶  create_fleet() / update_fleet() /
/app/fleets (member): the same cards, read-only                  retire_fleet() / restore_fleet()
                                                                 (owner only, security definer)
```

## Decisions

1. **A fleet is optional.** When the workspace has active fleets, the fleet step offers them and a
   **PLAY SOLO** card. When it has none, the step is skipped. A solo player's row has no team. A
   player is "ready" once they have a player row, whether or not they have a fleet.
2. **Solo scoring is personal only.** A solo player earns every personal point and all XP. Bonuses
   that need a fleet (rescue, planet-owner credit, the cross-fleet multiplier) stay fleet-only, and
   fleet rankings leave solo players out. The game's economy does not change.
3. **The workspace's owner manages its fleets,** and only the owner. This is the first reader of
   `workspace_members.role = 'owner'`, through a helper, `is_owner(workspace)`.
4. **Fleets are written through owner-only functions:** `create_fleet`, `update_fleet`,
   `retire_fleet` and `restore_fleet`, each `security definer`, run as the signed-in person, and
   refusing anyone who is not the workspace's owner. Each validates its fields: the label is 1 to 12
   characters, the colour is `#rrggbb`, the motto is at most 60 characters, and the mascot is one of
   the known mascot keys or none. `create_fleet` derives the fleet's `name` (its key) from the label,
   made unique within the workspace. The `name` never changes afterwards, because ledger events name
   it. Nothing ever deletes a fleet: removing one retires it. At most 12 fleets are active per
   workspace.
5. **What an owner sets:** the label, the colour, the motto, and a mascot from the existing sprite
   set, or none, in which case the fleet is drawn as a hero in its colour. No uploads.
6. **Vertuoza's owner:** a one-time migration makes the member whose GitHub login is `pierrederval`
   the owner of the `vertuoza` workspace, when that account is a member. Vertuoza's existing fleets
   stay its own.
7. **The page is `/app/fleets`**, linked from a **Fleets** card on `/app`, in the app's shared top
   bar. An arcade fleet editor is a later PRD.
8. **No fleets yet, and signed out, shows an invitation, not a dead end:** *NO FLEETS YET — RAISE
   YOUR OWN!* over a parade of the mascot sprites. The owner also reads "SET THEM UP AT /app/fleets"
   and a member reads "ASK YOUR OWNER". Signed out, the attract mode shows the same tagline and parade
   instead of Vertuoza's six fleets.
9. **No Vertuoza leftovers.** A signed-in workspace whose database read fails shows an error, never
   the demo fleets. Flavour keyed by a fleet's name (HOME's card rules, sound motifs) is keyed by its
   mascot instead. The attract line counts the real fleets, or goes away when there are none. The
   sprite set stays as the shared mascot library.
10. **Screens with no fleet to show hide their fleet parts:** the fleets wall, TOP FLEETS, the Hall
    of Heroes' fleet column and the dashboard's "Fleets · season". A solo player reads **SOLO**,
    never "UNCREWED". The menu shows **MY HERO** to anyone with a player row. **CHANGE FLEET** reads
    **JOIN A FLEET** for a solo player, and is hidden when the workspace has no fleets.

## User stories

1. As a newcomer whose workspace has no fleets, I name my hero, build it and play, with no fleet
   step.
2. As a player in a workspace with fleets, I can pick **PLAY SOLO**, and later join a fleet from the
   menu.
3. As a workspace owner, I open `/app/fleets`, create a fleet with a label, a colour, a motto and a
   mascot, see its card as I type, and find it on the arcade's fleet step.
4. As a workspace owner, I edit a fleet's look, retire it, and restore it, and its history keeps its
   look throughout.
5. As a member, I see my workspace's fleets on `/app/fleets`, and I am told only the owner can change
   them.
6. As a signed-out visitor, the arcade's attract mode invites me to raise my own fleet, and never
   shows another company's fleets.

## Scope

**In:**

- A migration: `is_owner(workspace)`; `create_fleet`, `update_fleet`, `retire_fleet` and
  `restore_fleet`, with their validation and grants to `authenticated`; the known mascot keys as the
  functions check them; the `vertuoza` owner; updated comments on `teams` and `players`.
- `supabase/checks/fleets.sql`, run by the `supabase` workflow.
- The arcade: the optional fleet step and PLAY SOLO; a player row without a team; `isReady`,
  `afterGate` and `nextStep` for all three cases; the menu (MY HERO, JOIN A FLEET); the "raise your
  own" screen and parade; SOLO; hiding fleet parts when there are none; the attract line.
- The demo world without Vertuoza's fleets. A signed-in read failure shows an error. Flavour is keyed
  by mascot.
- `/app/fleets` for the owner and for members, and its card on `/app`.
- The dashboard's fleet parts hidden with no fleets, and its "Join a fleet" copy.

**Out:** an arcade fleet editor; uploading a mascot; transferring or sharing ownership; changing
the game's scoring; renaming a fleet's `name` key.

## Test seams

Tests sit beside the code (`*.test.ts` under `apps/galaxy/src/`, `*.test.mjs` in `packages/` and
`game/`), and run with `pnpm test`. SQL checks are under `supabase/checks/`, and the `supabase`
workflow runs them on every pull request.

- **`supabase/checks/fleets.sql`:**
  - The owner creates, updates, retires and restores a fleet.
  - A member, a member of another workspace and `anon` are refused each function.
  - The label, colour, motto and mascot are checked at every edge (0 and 13 characters, a colour
    that is not hex, an unknown mascot).
  - `name` is derived and unique, and never changes on update.
  - `authenticated` still cannot insert, update or delete `teams` directly.
  - At most 12 fleets are active.
  - `vertuoza` has its owner when that member exists.
- **Onboarding** (`apps/galaxy/src/arcade/onboarding.test.ts`): with fleets and a picked fleet, with
  fleets and solo, and with no fleets (the step is skipped). `isReady` is true for a solo player.
- **The arcade's screens:**
  - The menu items for a solo player, a fleet player, and a workspace with no fleets.
  - The "raise your own" screen for the owner and for a member.
  - SOLO, never UNCREWED, for a player.
  - Fleet parts hidden with zero fleets.
  - The attract line.
- **`/app/fleets`:**
  - The owner's view (the form, the preview, edit, retire with confirmation, restore) and a member's
    read-only view.
  - Each refusal shown next to its field.
- **No leftovers:** a source scan outside `supabase/migrations/`, `supabase/seed.sql` and the
  tests fails on either of these:
  - the fleet-only names `pirates`, `cia` or `invincible-team`;
  - a lookup keyed by fleet name (`FLEET_SPRITE`, HOME's `RULE_OF`, the sound `MOTIFS` by fleet).

  `beaver`, `octopod` and `picsou` are also mascot keys, so they stay in the sprite set.

## Risks

A merge to `main` applies the migration to production Supabase and deploys galaxy:

- Owners can write fleets through the new functions.
- `vertuoza` gets its owner.
- Players can play solo.

Existing players and fleets are untouched, and the economy does not change. **Rollback:** revert the
feature PR. A follow-up migration drops the four functions and `is_owner`. Fleets created meanwhile
stay, because ledger events may name them.

## Acceptance criteria

1. In a workspace with no fleets, a new player goes from intro to name to hero to ready with no fleet
   step, and plays. Their player row has no team.
2. In a workspace with fleets, the fleet step offers each active fleet and PLAY SOLO. Picking PLAY
   SOLO makes a player with no team, and the menu then offers JOIN A FLEET.
3. The workspace's owner creates a fleet on `/app/fleets` (label, colour, motto, mascot), and it
   appears on the arcade's fleet step. They edit its look and retire and restore it. Its `name` never
   changes.
4. A member on `/app/fleets` sees the fleets read-only. Calling any fleet function as a member or
   `anon` is refused, and nothing changes.
5. A label of 0 or 13 characters, a colour that is not `#rrggbb`, a motto over 60 characters, an
   unknown mascot, or a 13th active fleet is refused with a message naming the field.
6. With no fleets, the fleet screens show "NO FLEETS YET — RAISE YOUR OWN!" and the mascot parade.
   The owner reads the `/app/fleets` pointer, and a member reads "ASK YOUR OWNER".
7. Signed out, the attract mode shows the tagline and parade and no Vertuoza fleet. A signed-in read
   failure shows an error, never the demo fleets.
8. A solo player reads SOLO wherever a fleet is shown. With zero fleets, the fleets wall, TOP
   FLEETS, the Hall of Heroes' fleet column and the dashboard's "Fleets · season" are hidden.
9. The source scan finds no Vertuoza fleet-only name and no fleet-name-keyed lookup outside the
   migrations, the seed and the tests.
10. `vertuoza`'s owner is the member whose GitHub login is `pierrederval`.
