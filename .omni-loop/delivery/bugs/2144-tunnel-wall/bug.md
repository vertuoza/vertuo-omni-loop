# Bug 2144: OMNI KART: a kart drives through COMET RING's tunnel wall and falls into the void

## Triage

- **Domain:** OMNI KART (`apps/galaxy/src/arcade/kart`): the kart's motion (`kart.ts`) and COMET RING's tunnel (PRD 1775, PRD 1829)
- **Risk:** medium — a player on COMET RING who steers into the tunnel wall drives through it and falls into the void, losing seconds and sometimes the race; the workaround is to keep clear of the walls (Jev, 0.92)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/galaxy/src/arcade/kart/kart.wall.test.ts`
- **Red:** AssertionError: expected { off: 139, fell: -1 } to deeply equal { off: -1, fell: -1 }

## Fix

The tunnel's walls were drawn only: under the roof the kart's motion read the void's edge like any
other, so a kart steered into a wall drove through it and fell. A step under the roof now keeps the
kart's centre on the road and its body off the wall; a step that runs into the wall is pushed back
off it a pixel at a time, along the way the wall faces, so the kart slides along it, its nose turned
along the wall (`RULES.wallTurn`) and its speed scraped while it rubs (`RULES.scrape`). Under the
roof no wheel over the void pulls the kart towards the edge, and it never tips.

## Guard

`apps/galaxy/src/arcade/kart/kart.wall.test.ts`, "every circuit's tunnel holds a kart along its
whole length": for every circuit of the register with a tunnel, a kart driven at 45° and 90° into
either wall, from every tile of the tunnel, stays on the road while under the roof. Red on the
default branch ("expected [ '0.5 tiles in, -90°', …(43) ] to deeply equal []"), green on the fix
branch.

## Mutation

mutation: no changed core file against origin/main (a533dac7): nothing to mutate
