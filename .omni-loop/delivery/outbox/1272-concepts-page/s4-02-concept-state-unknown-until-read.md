---
id: s4-02-concept-state-unknown-until-read
prd: 1272
slice: s4
rank: medium
bears-on: none
raised: 2026-10-08
wave: 4
---

## The question, in plain words

What does a concept show when its review has not been found on GitHub, or has not been checked yet?

## The decision, in plain words

It shows "state unknown" in both cases. The list never asks GitHub itself: it shows what was last stored, which the regular sync or a visit to the concept's page fills in.

## The intro, for fun

Nobody has checked on the concept yet, and the page refuses to guess how it is doing.

## The punchline, for fun

Honest beats hopeful: it says it does not know until someone looks.

## The options, in plain words

A. A. Show "state unknown" for no pull request found and for not read yet, as built.
B. B. Show a separate "no concept PR" chip when none is found on the concept's branch.
C. C. Have the list ask GitHub for a concept with no stored facts, at the cost of GitHub reads on every view.

## What I had to decide

Two cases the spec does not name: a concept with no open or merged pull request on its branch (closed without merging, or renamed), and a concept the sync has not read yet.

Decided by: Jev (hardToRevert 0.46) · agent said false

## What I did meanwhile

conceptState (src/concepts/state.ts) gives 'unknown' when the stored pull request is UNREAD or null, as well as with no stored facts. /concepts reads only fix_facts, as the signed-in person, one read per workspace, never GitHub; a new concept reads 'state unknown' until the stages sync (every 15 minutes) or its own page stores its facts. The page reads the stored facts first and, with none, asks GitHub once and stores the answer after the response.

## What it costs to change later

One branch in conceptState to show another word (for example "closed") for a concept with no pull request, or one read in the list to ask GitHub when nothing is stored. No migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names only an open pull request, a merged one, and one that could not be read.
