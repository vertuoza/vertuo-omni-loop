---
id: s1-02-wave-3-pages-overlap-with-kit-prds
prd: 3219
slice: s1
rank: medium
bears-on: none
raised: 2026-11-24
wave: 1
---

## The question, in plain words

The two page-redesign PRDs of this roadmap (Fleets, Repositories, API keys; Business, Jev, Playbook) build in the same wave as this one and edit some of the same page files. Who goes first?

## The decision, in plain words

This plan edits each page's loader and data wiring and, for Business, the section that holds the agent cards. Whichever pull request merges second brings the other's changes in; the plan declares its territories so a person can see the overlap.

## The intro, for fun

Three crews, one set of pages.

## The punchline, for fun

Last one in tidies up.

## The options, in plain words

A. A. Plan independently; the second to merge rebases (as planned)
B. B. Block this PRD behind the two page PRDs
C. C. Block the two page PRDs behind this one

## What I had to decide

Taken without asking: planned independently, the overlap is for the merge order to settle, not for this plan to guess.

## What I did meanwhile

The plan keeps its edits to the pages' reads and the Business agent cards.

## What it costs to change later

A merge conflict in a page file for the second pull request, resolved by rebasing.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The other PRDs have no plan yet, so their territories are unknown (author)
