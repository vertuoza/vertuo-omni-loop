# Bug 1424: OMNI KART never counts a lap at the finish line, so the race never ends

## Triage

- **Domain:** OMNI KART, the arcade's kart racer: laps and waypoints (`apps/galaxy/src/arcade/kart/rivals.ts`, `advance`)
- **Risk:** high — A player who cuts a corner on the inside of the road never passes its waypoint, so no lap counts, the race never ends and no score is saved; the only way round it, driving through the middle of every corner, is invisible to the player. (Jev, 0.72)
- **Regression:** new bug — no evidence this ever worked (shipped with PRD 1359, #1362)

## Reproduction

- **File:** `apps/galaxy/src/arcade/kart/rivals.test.ts`
- **Red:** `× counts a lap when every corner is taken tight on the inside` — `AssertionError: expected { Object (pace, walls) } to deeply equal { pace: { laps: 1, passed: +0 }, …(1) }`, with `"laps": 0` and `"passed": 0` (and the same for `cut over the grass inside`)

## Fix

A waypoint counted only within `RULES.waypointReach` (40 px) of its corner's centre, but the road is
five tiles (80 px) wide: a kart cutting the corner on the inside passes about 45 px from it, so its
waypoint stayed unpassed and the line never counted another lap. `advance` now also passes a waypoint
when the kart crosses its corner's diagonal forwards within `RULES.cornerGate` (104 px, out to the
walls behind the grass), and the reach stays as it was, so the rivals drive as before.

## Guard

none — the check that would have caught it is the reproduction itself, a lap driven off the racing
line; the lap tests before it drove only along the line.

## Mutation

mutation: no changed core file against origin/main (4af43b1d): nothing to mutate
