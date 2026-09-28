---
id: s2-01-docs-page-test-follows-new-install
prd: 420
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

The test that checks how the guide's pages look still expected the old twelve-step install page, and it sits outside the files this piece of work was allowed to touch. Should it have been left for someone else?

## The decision, in plain words

The test was updated so it checks the new five-step install page and the new help entries instead of the old steps. Nothing else in it changed.

## The intro, for fun

Rewrite the install page, and the test that memorised the old one starts to cry.

## The punchline, for fun

So it got a new page to memorise, and it is happy again.

## The options, in plain words

A. Update the rendering test in this slice, beside the page it checks (built).
B. Leave the rendering test red here, and fix it in a separate slice.
C. Drop the install page's expected blocks from the rendering test, keeping only the badge check on every page.

## What I had to decide

Whether the page-rendering test may follow the new install page in this slice, or should be changed in a slice of its own.

## What I did meanwhile

The rendering test checks the new install blocks (the npm line, omni --version, omni init, git switch main, omni config, /omni:help) and two troubleshooting blocks (gh auth setup-git and the ask: file lines).

## What it costs to change later

Low: one test file, a few expected lines. Undoing it means writing those expectations elsewhere.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's territory for s2 did not list apps/galaxy/src/docs/docs.test.ts, although rewriting install.md was bound to break it (author).
