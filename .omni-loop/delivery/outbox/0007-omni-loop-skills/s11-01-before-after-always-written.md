---
id: s11-01-before-after-always-written
prd: 7
slice: s11
rank: medium
bears-on: none
raised: 2026-09-25
wave: 6
---

## The question, in plain words

When a change has nothing anyone can see, like a guard or a setting, should the idea still come with its today-and-after page?

## The decision, in plain words

Yes, always. A change with nothing visible gets a short page saying what changes and what stays the same, so the review packet always has the same three parts.

## The options, in plain words

A. Always write the page; a short text one when nothing is visible (built).
B. Add a flag to omni phase0 so a page-less PRD passes, and write no page as upstream did.
C. Write no page and accept the phase-0 check's not ok for that one missing kind.

## What I had to decide

Upstream brainstorming wrote no before/after page for a change with nothing to show, and said so. The kit's phase-0 command (omni phase0) grades a phase-0 pull request with phase0Verdict at its default needsBeforeAfter: true and offers no flag to turn it off, so a page-less phase-0 PR prints not ok. The skill cannot both follow upstream and leave the check green.

## What I did meanwhile

Step 5 of the brainstorm skill always writes before-after.html; for nothing visible it is a short today-beside-after page. The Handoff's Before/after line is always the repository path, never none.

## What it costs to change later

A constant: if the answer is B, omni phase0 gains a --no-before-after flag passing needsBeforeAfter: false, and step 5 goes back to writing no page and the Handoff saying none.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether reviewers find a text-only page useful or noise has not been tried (author).
