---
id: s8-01-adr-number-and-guide-place
prd: 1089
slice: s8
rank: medium
bears-on: none
raised: 2026-10-06
wave: 7
---

## The question, in plain words

Which number does the new decision record take, now that the one the plan named is used, and where does the new guide page sit among the others?

## The decision, in plain words

The record takes the next free number on the main line, sixty-nine, and the new page sits right after the page on landings, which now points to it as the page to read next.

## The intro, for fun

The plan reserved seat sixty, and someone else was already sitting in it.

## The punchline, for fun

We took seat sixty-nine and left a note on the landings page saying where we went.

## The options, in plain words

A. A. Keep it: record 0069, and the flow page right after Landings, whose Next link points to it.
B. B. Keep record 0069, and put the flow page after Use cases, just before Troubleshooting.
C. C. Add a list of every record to the decision records' README, so the index the plan mentions exists.

## What I had to decide

Whether the record number sixty-nine and the guide page's place after Landings are what the team wants, given both touch ground the plan did not list.

## What I did meanwhile

Wrote .omni-loop/knowledge/adr/0069-a-repository-s-flow-may-replace-the-act-at-a-named-point-never-a-guard.md (main already holds 0060 to 0068), placed docs/guide/flow.md after landings in docs/guide/meta.json, and changed the Next link of docs/guide/landings.md, a file outside the slice's territory, to point to it. The ADR README holds no index, so it was left unchanged.

## What it costs to change later

A rename of one file and its two mentions, or moving one page in meta.json and its Next links with the guide tests; no stored data moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory names .omni-loop/knowledge/adr/0060-, written before 0060 to 0068 landed on main; the caller asked for the next free number.
- (author) Any new guide page changes the Next link of the page before it, so one file outside the territory changes whatever the place chosen.
- (author) The plan's done-when says the ADR index lists the record, but .omni-loop/knowledge/adr/README.md lists no record, so nothing was added there.
