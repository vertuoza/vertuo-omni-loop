# Bug 1868: OMNI KART lags when entering COMET RING's tunnel

## Triage

- **Domain:** OMNI KART's renderer: the tunnel's vaulted ceiling, `apps/galaxy/src/arcade/kart/mode7.ts` (PRD 1829)
- **Risk:** high — every player of OMNI KART drops to a few frames a second through the tunnel on every lap, and there is no workaround but to drive through it; no data is lost (Jev, 0.91)
- **Regression:** yes — #1859 (s4 of PRD 1829, merged with #1840). The median `renderTerrain` frame in the tunnel at 640×360 was 20 ms on main before #1840 and 22 ms after s3, and it is 170 ms after s4. Open-road frames stay around 8 ms throughout.

## Reproduction

- **File:** `apps/galaxy/src/arcade/kart/mode7.test.ts`
- **Red:** `AssertionError: expected 23.769179797744098 to be less than or equal to 5`

## Fix

Each stretch of road under the roof found its ceiling row by row. It scanned two padded rows on each side and bisected 7 times per row, and every probe worked out the arc again with a square root. That is millions of reads per frame. Now the ceiling's height is worked out once per texture pixel, beside the vault's distance map. It is read at the ends of pieces at most 2 units long and taken as straight between them, so the distance at which a row's ray meets it is solved in one step, and only for the rows between the piece's two ends. A tunnel frame at 640×360 now takes about 30 ms, against 170 ms before the fix and about 26 ms with a flat ceiling.

## Guard

The reproduction sits in the tunnel's cost guard. That guard counted only samples per column, which stayed the same while the ceiling's work grew; the new test times a frame inside the tunnel against a frame on open road, taking the medians of interleaved rounds. It fails on main at about 24 times and passes on the fix at about 3.5 times.

## Mutation

mutation: no changed core file against origin/main (7614020b): nothing to mutate
