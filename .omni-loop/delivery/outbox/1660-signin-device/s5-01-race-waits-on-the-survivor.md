---
id: s5-01-race-waits-on-the-survivor
prd: 1660
slice: s5
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

On a laptop the terminal waits for the browser and for the printed link at once. When one of the two fails, for example the link is refused or the page cannot be reached, should the terminal give up or keep waiting on the other?

## The decision, in plain words

It keeps waiting on the other and gives up only once both have failed, then says why the last one failed. A refused link or a dropped connection never cuts short a sign-in the browser is about to finish.

## The intro, for fun

Two doors were left open for the same guest, and one of them slammed shut.

## The punchline, for fun

The terminal kept an eye on the other door.

## The options, in plain words

A. A failure drops out and the other keeps waiting; the last failure is the one printed
B. The first way back to end, success or failure, ends the sign-in

## What I had to decide

Keep a failed way back dropping out while the other keeps waiting (A), or end the sign-in on the first way back to end, success or failure (B). Decided by: Jev (hardToRevert 0.50) · agent said false

## What I did meanwhile

Built as A: firstOf in kit/lib/ask/race.ts takes the first result to come back and closes the other; a failure drops out, and once both failed it fails with the last failure, which omni signin prints as its one line.

## What it costs to change later

B is a few lines in the race and two tests, at any time: nothing is stored and the page does not change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the sign-in finishes on whichever comes back first, without saying what a failure of one does to the other.
- (author) With A, pressing No on the fallback link leaves the terminal waiting for the browser until the loopback's own five minutes run out, and a loopback that times out leaves it waiting for the link's ten.
