---
id: s2-01-on-mode-still-asks-haiku
prd: 812
slice: s2
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

When Jev is trusted with sorting questions, should the old sorter still be asked every time as well?

## The decision, in plain words

Yes: with the question category On, the old sorter still answers every round beside Jev. Its answer is kept for comparison and counts at once whenever Jev cannot decide.

## The intro, for fun

Two referees on the pitch: only one blows the whistle, the other keeps notes.

## The punchline, for fun

It costs a few cents more, and the record never has a blank line.

## The options, in plain words

A. A. On still asks the old sorter every round, so the record keeps comparing and the fallback is immediate.
B. B. On asks the old sorter only when Jev cannot decide, saving that call but leaving the record without a comparison for most rounds.

## What I had to decide

Whether a round whose category decision is On still calls the old sorter (Haiku through OpenRouter) alongside Jev, or calls it only when Jev fails or answers under the floor.

## What I did meanwhile

Shadow and On both run the old sorter and Jev side by side after the response; On keeps Jev's answer when it counts and the old one otherwise, and every call is logged with both answers.

## What it costs to change later

One branch in the resolver's decide step: run the old path after Jev instead of beside it. No stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec says Shadow runs both and that the record compares like with like, but does not say whether On keeps paying for the old sorter on every round
