# Bug 1689: OMNI DUET — moving centre blocks change nothing; more chained sequences, ghosts and a speed-up at each wave's end

## Triage

- **Domain:** OMNI DUET's waves and their drawing (`apps/galaxy/src/arcade/duet/waves.ts`, `art.ts`, PRD 1633)
- **Risk:** low — the game plays, but its moving pieces ask nothing and its later waves lack the variety Duet has.
- **Regression:** new bug — found playing after #1685

## Reproduction

- **File:** `apps/galaxy/src/arcade/duet/waves.test.ts`
- **Red:** on main, the orbs held level never touch a sliding centre block: `× main: holding the level pose still is hit by a sliding centre block` — `AssertionError: expected false to be true`.

## Fix

Moving pieces now matter. A sliding centre block swings ±1 R across the circle and is dodged by turning
its way; a turning centre piece is a rod 2.2 R long spinning at 0.6 turns a second, followed round. Half
bars are still only (moving, they only ever moved away from the upright orbs). Chapters II–IV chain
spirals (three or more moving pieces the same way round, passed holding one turn) and zigzags (three or
more, each the other way round). `ghost` obstacles fade from entry to nothing 2 R above the circle: in
chapter IV's waves 7–10 (wave 8 rods only, wave 9 all ghosts) and in endless from its 11th wave, now and
then a whole themed wave. Each wave's fall speeds up over its last 35% by 30% (15% in chapter I); the
turn never changes and a wave's written speed is unchanged.

## Guard

Every moving piece is hit by any pose held still and passed by a person turning its way, and only so;
spirals and zigzags are recognised and checked by route; ghosts change nothing to collisions; every
chapter wave and the first 200 endless waves pass the spacing rule and the human check with room to
spare, fail held still and last 8 s at most.

## Mutation

mutation: not run (arcade only, no delivery-core file changed)
