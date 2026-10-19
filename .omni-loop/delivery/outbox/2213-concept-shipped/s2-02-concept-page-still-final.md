---
id: s2-02-concept-page-still-final
prd: 2213
slice: s2
rank: medium
bears-on: none
raised: 2026-10-19
wave: 1
---

## The question, in plain words

A concept's own page still treats a merged concept as settled and does not re-read GitHub in the background, so a close or reopen done on GitHub shows on the page only after the next sync or the instant GitHub event. Should the page re-read too?

## The decision, in plain words

Only the sync and the GitHub event refresh a merged concept now; the page keeps showing what is stored, which is at most one sync old.

## The intro, for fun

The page believes a merged concept never changes its mind.

## The punchline, for fun

The sync knows better and quietly keeps it up to date.

## The options, in plain words

A. A. Leave the page reading a merged concept as settled (as built).
B. B. Make the page re-read a merged concept in the background.

## What I had to decide

The page's read rule lives in apps/galaxy/src/dossier/page/fix-facts.ts, outside this slice's territory, and still uses isConceptFinal, which stays exported unchanged. Answer A leaves the page as is; B has s3 or a follow-up make the page re-read a merged concept.

## What I did meanwhile

The page can be up to one sync run behind a change made on GitHub; the event refreshes it at once.

## What it costs to change later

A merged concept page would add one background read per view if changed.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the extra read matters at the workspace size is unmeasured (author)
