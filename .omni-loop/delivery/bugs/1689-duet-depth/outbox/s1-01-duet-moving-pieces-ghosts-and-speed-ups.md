---
id: s1-01-duet-moving-pieces-ghosts-and-speed-ups
prd: 1689
slice: s1
rank: high
bears-on: BR-PRODUCT-102
raised: 2026-10-12
wave: 1
---

## The question, in plain words

The waves are rewritten again: moving centre pieces now force a turn, runs of them ask to hold one direction or switch at each one, some obstacles fade out before they arrive, and each wave falls a little faster at its end. Endless mode keeps its rule and its written speeds, and now mixes in fading obstacles and the odd wave of only turning bars or only fading ones. Is that fine?

## The decision, in plain words

Endless still draws one to three of chapter IV's own runs from a fixed seed, written at 145 rising to 155; the speed-up at each wave's end comes on top of that written speed, and every wave stays proven passable for a person.

## The intro, for fun

The obstacles learned to move with intent, and some to vanish.

## The punchline, for fun

They still keep their promise: every wave has a way through.

## The options, in plain words

A. Keep the new moving pieces, ghosts and end-of-wave speed-ups; endless keeps its written speeds (built).
B. Keep the waves as they were before this fix.

## What I had to decide

BR-PRODUCT-102 (endless waves from the last chapter's own rows and a fixed seed, a speed starting just above that chapter's fastest, rising slowly to a ceiling, every wave passable) is enforced by `duet/waves.ts` and `duet/waves.test.ts`. The range changes both: endless groups are cut so a run of moving pieces stays whole, ghosts and themed waves appear from endless wave 11, and each wave speeds up over its end. The speed the law names is read as a wave's written speed (145, +1 every 5 waves, 155), the end-of-wave speed-up stored apart.

## What I did meanwhile

The branch holds the new waves; every chapter wave and the first 200 endless waves pass the human check with room to spare.

## What it costs to change later

Wave text and a few constants in one file.

## What I could not know

- Whether the law's "speed" should count the end-of-wave speed-up: read as the written speed, the law's text is left as is (author).
- Whether it feels right: proven passable, not played in the browser (author).
