# Bug 1672: OMNI DUET — the blocks sit on a grid that ignores the circle, so the waves feel incoherent

## Triage

- **Domain:** OMNI DUET's waves (`apps/galaxy/src/arcade/duet/waves.ts`, PRD 1633)
- **Risk:** medium — the game plays, but its blocks land where no clear pose of the orbs dodges them, so the waves read as random and a pose a player trusts can still be hit.
- **Regression:** new bug — found playing after #1668, which kept the same cell grid

## Reproduction

- **File:** `apps/galaxy/src/arcade/duet/waves.test.ts`
- **Red:** on main, `parseWave('speed 60\n#####.....')`, the five-cell half bar from the left, strikes the pair held upright as it reaches the circle: `× main: an orb held upright clears a five-cell half bar from the left` — `AssertionError: expected true to be false`. The ten 16 px cells span x 80–240 and the circle's centre is x 160: a five-cell bar ends exactly on the centre line, where an upright orb stands.

## Fix

The waves are written in a vocabulary set on the circle, after the mobile game Duet as its open-source
clones measure it. Each obstacle is dodged by one clear pose: a half bar from a wall, 2 R long, ending
R/3 short of the centre line (orbs upright); a centre block, 0.75 R square, on the axis (orbs level); an
upright bar, 1.5 R tall, standing on the circle's edge (orbs upright). Each comes still, sliding or
turning. A wave is one obstacle per line with the free space above it in R. Two obstacles of one pose
may follow closely; a change of pose stands at least a quarter turn plus a person's reaction behind the
one before. Chapter I alternates half bars and centre blocks 3–4 R apart; chapter II adds sliding,
chapter III turning, chapter IV mixes them tighter. Endless mode draws one to three of chapter IV's own
runs of one pose.

## Guard

`the vocabulary` in `waves.test.ts` checks every kind, side and motion at three speeds: its one pose
clears it, with room for orbs 2 px wider, and the other pose hits it. `spacingProblems` checks the
distance before every change of pose in every chapter wave and the first 200 endless waves, on top of
the human passability check.

## Mutation

mutation: not run (arcade only, no delivery-core file changed)
