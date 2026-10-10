# Bug 1454: Super Omni World — the hero cannot jump high enough to reach the platforms

## Triage

- **Domain:** Super Omni World, the arcade's platformer: the jump and the stage checks (`apps/galaxy/src/arcade/platformer/rules.ts`, `stages.ts`, PRD 817)
- **Risk:** medium — players cannot reach the brick and ? block rows five tiles over the ground in every stage, so their blocks and coins are out of reach; the stages can still be cleared along the ground. (Jev, 0.92)
- **Regression:** new bug — no evidence this ever worked (the jump, the stages and Phaser are as #818 shipped them)

## Reproduction

- **File:** `apps/galaxy/src/arcade/platformer/rules.test.ts`
- **Red:** `× lands on a ledge five tiles over the ground, where the stages put their bricks and ? blocks` — `AssertionError: expected 4 to be greater than or equal to 5`

## Fix

A ledge five tiles up needs a jump of 80 px, but a full jump topped out at about 77 px in Phaser. The
rules' own jump model said 85, because it stepped at 240 a second and left gravity out while A was
held, where Phaser's arcade physics steps at 60 and pulls on every step. `simulateJump` now plays the
jump as Phaser does, and `JUMP` leaves at 340 px/s and lifts for up to 0.21 s (from 330 and 0.14):
about 102 px at full hold, while a tap stays near 38 px.

## Guard

`stageProblems` now names a ledge higher than a jump (`highestLedge`, with a tile to spare) over
anything to jump onto it from, within four columns, with its own tests in `stages.test.ts`. On main's
jump it fails all three stages, naming every brick and ? block row out of reach; on the fix branch
they pass.

## Mutation

mutation: no changed core file against origin/main (ef18465f): nothing to mutate
