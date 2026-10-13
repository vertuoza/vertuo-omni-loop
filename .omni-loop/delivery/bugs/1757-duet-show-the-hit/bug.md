# Bug 1757: OMNI DUET never shows the contact that cost a life

## Triage

- **Domain:** arcade · OMNI DUET (`apps/galaxy/src/arcade/duet`, PRD 1633)
- **Risk:** low — players of OMNI DUET see a life lost while the orb still looks clear of the block, so a fair hit reads as an unfair one; the hit itself is right and the game plays on.
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/galaxy/src/arcade/duet/art.test.ts`
- **Red:** `× shows the contact that cost a life: the blocks stay where they struck under a fading flash, then the ready screen clears` — `AssertionError: #ff9ae8: expected false to be true`

## Fix

A hit sent the run straight to its ready screen, the wave reset to its start, so the last frame seen
was the one before the contact, the orb still a few pixels clear of the block. The run now keeps the
contact (`crash`: the wave, the sub-step and the pair's angle) for `CRASH_SECONDS` (0.5 s), and the
field draws the wave as it struck and the orbs where they were hit, under a white flash that fades
out (none under reduced motion). START lets it go at once; nothing else of the hit changes.

## Guard

The reproduction itself, with a run test of the crash's lifetime (it shows 0.5 s, fades, and START
clears it).

## Mutation

mutation: no changed core file against origin/main: nothing to mutate
