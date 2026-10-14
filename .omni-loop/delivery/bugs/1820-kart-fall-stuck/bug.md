# Bug 1820: OMNI KART: a kart that falls at the jump just before the tunnel stays stuck falling forever

## Triage

- **Domain:** galaxy arcade — OMNI KART, the way back after a fall (`apps/galaxy/src/arcade/kart/rivals.ts`, `comeBack`)
- **Risk:** high — every OMNI KART player on COMET RING (the default circuit) who falls into the gap jump comes back over the void and falls again forever: the race can no longer be finished, with no workaround but quitting; a rival that falls there is lost the same way (Jev, 0.97)
- **Regression:** yes — 0b390e17 (#1776, PRD 1775) put a gap of 3 tiles of void across the racing line on `[56, 28]` → `[56, 8]`, while PRD 1447's way back, the nearest point of the line, held "never over the void" only because every point of the line lay over road

## Reproduction

- **File:** `apps/galaxy/src/arcade/kart/race.test.ts`
- **Red:** AssertionError: still falling 3 s after its fall ended: expected 0.008333333333334384 to be +0

## Fix

The way back put a kart that fell into the gap jump on the point of the racing line nearest to it, which lies in the
gap: the kart fell again in the same step, and its fall never ended. Now, where that point is over the void, `comeBack`
walks back along the segment to the gap's edge and on by `RULES.runUp` (6.5 tiles): the kart comes back at rest on the
run-up pad before the ramp, as the reporter chose, and from there even the slowest rival clears the gap.

## Guard

`apps/galaxy/src/arcade/kart/rivals.test.ts`, "is never over the void, wherever on the racing line the kart fell": it
drops a kart on every point of every segment of COMET RING's racing line, every 4 units, where the old check only tried
the waypoints. It finds 12 points whose way back is over the void on main's `rivals.ts`, and none here.

## Mutation

mutation: no changed core file against origin/main (c7f9d58e): nothing to mutate — OMNI KART is not in the mutated delivery core
