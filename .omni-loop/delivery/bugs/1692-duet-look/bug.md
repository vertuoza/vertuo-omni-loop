# Bug 1692: OMNI DUET — Duet's pace, its missing shapes (gate, upright rectangle, short bar, rod chains) and its look

## Triage

- **Domain:** OMNI DUET's waves, drawing and text layer (`apps/galaxy/src/arcade/duet/`, `scenes/duet.*`, PRD 1633)
- **Risk:** low — the game plays; it differs from the feel of the game it is inspired by, as measured from recordings of the original's story and endless modes.
- **Regression:** new bug — found comparing with the original after #1694

## Reproduction

- **File:** `apps/galaxy/src/arcade/duet/waves.test.ts`
- **Red:** on main, endless mode tops out at 155 px/s where the original's endless runs at about 3 R a second (170 px/s here): `× main: endless mode reaches about 3 R a second (170 px/s)` — `AssertionError: expected 155 to be greater than or equal to 170`.

## Fix

Pace: the end-of-wave speed-up is light (+10% over the last 35%, none in chapter I); endless starts at
145, just above chapter IV's fastest, rises by 1 every two waves to a ceiling of 170 px/s (about 3 R a
second), with groups of one pose 1.25 R apart. New still shapes, each with one clear pose: a gate (two
bars either side of a 0.8 R gap on the axis, passed upright), an upright block (0.8 × 1.3 R) and a short
centred bar (1 × 0.33 R), both passed level; chains of two or three rods turning the same way, 1.25–1.4 R
apart, out of phase, passed holding that turn. Look: a soft trail fading up above every obstacle (off
under reduced motion), a background of its own per chapter and a darker one for endless, and a short
line of our own words as each wave begins.

## Guard

Per-shape tests (the one pose clears, the other hits; held still hits a moving piece), the rod chains
read as spirals and checked by route, the endless pace (start, rise, ceiling), the trail and backgrounds
drawn and still under reduced motion, a line per wave; the spacing rule and the human check with room to
spare on every chapter wave and the first 200 endless waves, each failing held still and lasting 8 s at
most.

## Mutation

mutation: not run (arcade only, no delivery-core file changed)
