---
id: s1-01-duet-show-the-contact
prd: 1757
slice: s1
rank: high
bears-on: BR-PRODUCT-101
raised: 2026-10-12
wave: 1
---

## The question, in plain words

When a block hits an orb, the screen now freezes on the contact for half a second under a white flash that fades, then the ready screen shows as before. Is that fine?

## The decision, in plain words

The run keeps the contact that cost a life for 0.5 s: the wave as it struck and the orbs where they were hit, under a fading flash (no flash under reduced motion); START lets it go at once. BR-PRODUCT-101 (quitting from the pause or B on a ready screen ends the run at its game over) is untouched: its tests now wait out the contact before checking that nothing moves.

## The intro, for fun

The orbs finally see what hit them.

## The punchline, for fun

Half a second of truth, then back to the dance.

## The options, in plain words

A. Freeze on the contact for 0.5 s under a fading flash (built, chosen by the person who reported it).
B. Freeze on the contact without a flash.

## What I had to decide

BR-PRODUCT-101 is enforced by `duet/run.test.ts`; two of its checks read that a step on the ready screen and the game over moves nothing, and a step now lets the contact fade. They wait the contact out first; the law's statement holds as written.

## What I did meanwhile

The branch freezes on the contact and flashes; the Duet tests are green.

## What it costs to change later

`CRASH_SECONDS` and `FLASH`, two constants.

## What I could not know

- Whether 0.5 s and the flash's brightness feel right: tested, not played here (author).
