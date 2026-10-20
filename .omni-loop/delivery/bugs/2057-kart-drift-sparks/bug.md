# Bug 2057: OMNI KART: the player's drift sparks are hidden under their own kart sprite

## Triage

- **Domain:** OMNI KART › the race's drawing: the particles (`apps/galaxy/src/arcade/kart/art.ts`, `fx.ts`; PRD 1963, PRD 1427 slice 7)
- **Risk:** low — cosmetic: the drift, its charge and its mini-turbo work and the ticks still tell the charge, but the player barely sees their own sparks on the wide grid and never on the tall one; reduced motion's still glow shows (Jev, 1.00)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/galaxy/src/arcade/kart/art.sparks.test.ts`
- **Red:** AssertionError: expected 546 to be greater than or equal to 3328 (wide grid); AssertionError: expected 0 to be greater than or equal to 832 (tall grid)

## Fix

The sparks were born 8 world pixels behind the kart's middle. The camera sits about 66 pixels
behind the player's kart on the wide grid and 42 on the tall one, so a spark born there lands
under the bottom of the player's sprite (wide) or below the screen (tall). The frame then drew
every particle before the player's kart, so the kart covered the few that were left. Now the
sparks are born at the rear wheels where a kart's sprite draws them, on the floor under its
middle, and the particles nearer the camera than the player's kart are drawn over it (the
others still go under it).

## Guard

The reproduction drives a full-speed drift on COMET RING. It checks that, frame after frame, the
player sees at least as much of their sparks as the still glow shows when motion is reduced, on
both grids. A unit test in `fx.test.ts` pins where the sparks are born: under the kart's middle,
one at each rear wheel. Both fail on main's code.

## Mutation

mutation: no changed core file against origin/main (4219a898): nothing to mutate
