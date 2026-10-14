---
id: s1-01-duet-room-to-time-each-move
prd: 1754
slice: s1
rank: high
bears-on: BR-PRODUCT-102
raised: 2026-10-12
wave: 1
---

## The question, in plain words

Every wave now leaves room to time each move: a press or a release of ◀ or ▶ may land 0.15 s late in the chapters, 0.12 s late in endless mode, and the wave still passes. For that, gates are wider, half bars stop a little further from the middle, endless waves leave a little more room before a change, and the longest endless wave grows from 8 to 8.5 seconds. Endless mode keeps its 170 px/s ceiling. Is that fine?

## The decision, in plain words

The gate's gap goes from 0.8 to 1 R, the half bar stops 0.45 R short of the centre line instead of R/3; the passability check plays a person whose changes land late, 0.15 s in the chapters and 0.12 s in endless mode; endless mode counts that time in its gaps and grows the gaps inside a group past chapter IV's speed, and keeps its ceiling of 170 px/s.

## The intro, for fun

The gates got a little wider.

## The punchline, for fun

Perfect play no longer has to be perfect to the frame.

## The options, in plain words

A. Keep it: 0.15 s in the chapters, 0.12 s in endless mode at 170 px/s (built, chosen by the person who reported it).
B. 0.15 s everywhere, endless mode back to a ceiling of 155 px/s.

## What I had to decide

BR-PRODUCT-102 (endless waves from the last chapter's own rows and a fixed seed, a speed rising slowly to a ceiling, every wave passable) is enforced by `duet/waves.ts` and `duet/waves.test.ts`. The fix keeps the law's statement: the ceiling stays 170 px/s, and "passable" now also means passable when each change lands late. The person who reported the bug chose the thresholds in the session: 150 ms, and 120 ms in endless mode rather than lowering its ceiling.

## What I did meanwhile

The branch holds the wider shapes and the late check; every chapter wave passes at 0.15 s and the first 200 endless waves at 0.12 s, with the existing checks still green.

## What it costs to change later

A few constants in `duet/rules.ts` and `duet/waves.ts`.

## What I could not know

- Whether the wider gate and shorter half bar look too easy in chapter I: measured, not played here (author).
