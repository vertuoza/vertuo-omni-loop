---
id: s2-01-chip-open-count
prd: 790
slice: s2
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

The health chip says how many review comments are still open. Should that count include the comments waiting for the product manager's decision, or only the ones nobody has handled yet?

## The decision, in plain words

The chip counts every comment not yet resolved on GitHub, so it includes the ones waiting for the product manager's decision as well as the ones nobody has handled.

## The intro, for fun

Two open comments, or one open and one waiting for you? The chip had to pick a meaning.

## The punchline, for fun

It went with the plain meaning: anything not resolved yet counts as open.

## The options, in plain words

A. count every unresolved thread, asked included (built)
B. count only the threads nobody has handled, matching the tab's open count
C. show two numbers on the chip, open and asked

## What I had to decide

The spec shows the chip as `CI ✓ · no conflict · 2 open` and, on the tab, separate counts of open, fixed, pushed-back and asked threads. It does not say whether the chip's open number includes asked threads.

## What I did meanwhile

`openThreads` in `apps/galaxy/src/dossier/github/care.ts` counts every unresolved thread (unhandled plus asked), and the chip uses it.

## What it costs to change later

A one-line change to the filter in `openThreads`, and its test expectations. No stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether people read the chip number as all unresolved comments is not tested with a product manager (author)
