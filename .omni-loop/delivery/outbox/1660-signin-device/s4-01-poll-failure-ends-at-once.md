---
id: s4-01-poll-failure-ends-at-once
prd: 1660
slice: s4
rank: medium
bears-on: none
raised: 2026-10-12
wave: 1
---

## The question, in plain words

While the terminal waits for the person to approve the sign-in, what should it do when one of its checks with the Omni page fails to get through?

## The decision, in plain words

It stops at once and says the page is unreachable, so the person runs the sign-in again, rather than quietly trying again for a while.

## The intro, for fun

The terminal knocked on the door, and nobody heard it once.

## The punchline, for fun

It went home instead of knocking again.

## The options, in plain words

A. A. End at once on the first failed check
B. B. Keep waiting through up to three failed checks in a row, then end

## What I had to decide

Keep the sign-in ending on the first check that fails (A), or let it ride over a few failed checks in a row before giving up (B).

## What I did meanwhile

Built as A: kit/lib/ask/device.ts ends its wait with the reason unreachable as soon as one poll cannot reach the page or gets an answer it cannot read, and omni signin prints omni signin: unreachable, exit 1.

## What it costs to change later

B is a counter of failed polls in the device module and one test, at any time: nothing is stored, and the page does not change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec lists unreachable among the endings without saying whether a single failed poll during the ten minutes is enough to end the wait.
