# Bug 2866: the New virtual fleet drawer stays on Creating… after the fleet is made

## Triage

- **Domain:** Virtual Fleets — the New virtual fleet drawer (`apps/galaxy/src/virtual-fleets/drawer/`)
- **Risk:** medium — creating a Virtual Fleet looks hung to every member; the fleet is made, and closing the drawer then reloading the Fleet page shows it
- **Regression:** new bug — no evidence this ever worked (the drawer shipped with #2845, PRD 2842 s1)

## Reproduction

- **File:** `apps/galaxy/src/virtual-fleets/drawer/new-fleet.test.ts`
- **Level:** unit
- **Red:** `TypeError: Cannot read properties of undefined (reading 'busy')`

## Fix

On a successful create, the drawer pushed the new fleet's page and refreshed, but never closed: the Fleet page stays mounted through that navigation, so the drawer stayed open in its busy state, reading Creating… for good. The drawer's state now has a `made` step that ends the busy state and names where it lands, and the drawer closes before it goes there.

## Guard

The reproduction: a drawer whose state has no step for a made fleet fails it, as `main`'s did.

## Mutation

mutation: no changed core file against origin/main (637a3492): nothing to mutate
