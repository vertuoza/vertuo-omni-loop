---
id: s1-02-law-proof-files-widened-for-the-fifth-game
prd: 2101
slice: s1
rank: high
bears-on: BR-PRODUCT-77
raised: 2026-10-16
wave: 1
---

## The question, in plain words

Four test files that also prove product laws had to change so they know about the fifth game. Is it fine that they now expect OMNI PONG, while the tests that prove the laws stay exactly as they were?

## The decision, in plain words

The files now expect five games, the new game's board and the LV 5 unlock, as the spec asks; the tests that prove the laws were not touched.

## The intro, for fun

Four rulebooks counted to four, and the arcade just learned to count to five.

## The punchline, for fun

The laws kept their lines; only the head count changed again.

## The options, in plain words

A. Keep the widened tests: the law proofs are unchanged, only the pinned game list, boards and unlocks grew to five.
B. Move the new game's assertions out of the law-proof files into new test files, leaving those files untouched.
C. Amend the laws themselves to name the fifth game.

## What I had to decide

Adopt A if a person confirms the laws in these files still hold. Pick B to move the new game's checks into files of their own, or C to amend the laws.
Decided by: Jev (hardToRevert 0.52) · agent said true

## What I did meanwhile

Built as A: the pinned unlocks gained pong: 5, the pinned game list, count and board lists gained OMNI PONG, and new tests cover the fifth cabinet and the wide grid's window on five. The law tests in the four files are byte for byte as on the feature branch.

## What it costs to change later

A constant: reverting is dropping pong from the pinned lists, and the game would then not exist.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The coverage guard marks any change to a file that holds a law's proof as a change to that law, and only a high item may account for it, so a person confirms the laws still hold (author).
