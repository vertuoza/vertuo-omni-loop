---
id: s5-01-ceilings-sized-for-what-lands-next
prd: 1679
slice: s5
rank: medium
bears-on: none
raised: 2026-10-12
wave: 3
---

## The question, in plain words

Three of this repository's first reading limits were set a little above what the branch measures today, so they stay green once the main branch and the sibling slice that adds the CI page's Budgets heading are merged in. Is that the right way to start, or should every limit match today's size exactly?

## The decision, in plain words

The limits for the CI page, the root agent instructions and the whole session start were sized for what the branch will hold after those merges, rounded up to the next kilobyte. Every other limit is today's size rounded up.

## The intro, for fun

A limit set to today's size can turn red tomorrow, the moment someone merges what was already written.

## The punchline, for fun

So three of them got a coat one size up, still well under the guideline.

## The options, in plain words

A. A. Size the CI page, root agent instructions and session limits for what lands next: 8 KiB, 7 KiB and 9 KiB (as built).
B. B. Every limit at today's branch size only: the CI page at 7 KiB, the session at 3 KiB, and no limit for the root agent instructions until they are measured here.

## What I had to decide

Answer A to keep the limits as built. Answer B to cut them to today's sizes; the next merge of the main branch then trims or lowers them in the same change.

## What I did meanwhile

The check is green on the branch and stays green after the main branch and the sibling slice are merged in.

## What it costs to change later

Changing it is editing three numbers in one file; nothing is migrated.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the session and root-instructions limits read the main branch's agent instructions file as it is today (6,271 bytes); a later change to that file on main is measured against them
- (author) the CI page's limit (8 KiB) assumes the sibling slice names its new template section `budgets`, as this slice's form does
