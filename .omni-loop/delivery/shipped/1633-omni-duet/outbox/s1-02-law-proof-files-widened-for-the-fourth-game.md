---
id: s1-02-law-proof-files-widened-for-the-fourth-game
prd: 1633
slice: s1
rank: high
bears-on: BR-PRODUCT-77
raised: 2026-10-11
wave: 1
---

## The question, in plain words

Two test files that also prove product laws had to change so they know about the fourth game. Is it fine that they now expect OMNI DUET, while the laws' own tests stay exactly as they were?

## The decision, in plain words

The files now expect four games and the LV 4 unlock, as the spec asks; the tests that prove the two laws were not touched.

## The intro, for fun

Two rulebooks counted to three, and the arcade just learned to count to four.

## The punchline, for fun

The laws kept their lines; only the head count changed.

## The options, in plain words

A. Keep the widened tests: the law proofs are unchanged, only the pinned game list and unlocks grew to four
B. Move the duet assertions out of the law-proof files into new test files, leaving those files untouched
C. Amend the laws themselves to name the fourth game

## What I had to decide

Keep A. game/rulebook.test.ts pins xp.unlocks, which the spec makes { invaders: 1, platformer: 2, kart: 3, duet: 4 }; apps/galaxy/src/arcade/games/room.test.ts pins the game list and cabinet count, which the spec makes four, and gains the duet cabinet and window tests (spec, Test seams, 'The room'). The proofs of BR-PRODUCT-77 and N-PRODUCT-10 in those files are unchanged.

## What I did meanwhile

Built as A in s1 and s2: the pinned unlocks gained duet: 4, the pinned game list and count gained OMNI DUET, and new tests cover the duet cabinet and the wide grid's window. The law tests in both files are byte for byte as on main.

## What it costs to change later

A constant: reverting is dropping duet from two pinned lists, and the game would then not exist.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The coverage guard marks any change to a file that holds a law's proof as a change to that law, and only a high item may account for it, so a person confirms the laws still hold (author).
