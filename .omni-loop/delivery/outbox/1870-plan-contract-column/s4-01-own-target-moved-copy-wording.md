---
id: s4-01-own-target-moved-copy-wording
prd: 1870
slice: s4
rank: medium
bears-on: none
raised: 2026-10-14
wave: 4
---

## The question, in plain words

When a repository that keeps its own knowledge has changed its planning settings since the copy was made, the targets report has no reading date to quote. What should the report say, and should a repository whose knowledge was imported but whose planning copy is missing also be reported as never copied?

## The decision, in plain words

The report says the settings moved since its copy was read, keeping the opening words the sync step looks for, and an imported repository with a missing planning copy keeps today's wording, that its copy lacks the settings.

## The intro, for fun

A copy with no date on it is like a photo with no caption.

## The punchline, for fun

We wrote 'since its copy' on the back and hoped nobody squints.

## The options, in plain words

A. Keep 'flow moved since read at its copy' for a target without a reading date, and today's wording for an imported target with no planning copy (as built).
B. Say 'flow moved since it was copied' for such a target, and update the sync step to match that opening too.
C. Also report an imported target with no planning copy as 'flow not copied', changing today's wording and its test.

## What I had to decide

Pick the wording of the stale line for a target without a reading date, and whether an imported target with no planning copy reads as never copied.

## What I did meanwhile

A target that keeps its own knowledge reads 'flow moved since read at its copy' when its copy differs, and 'flow not copied' when it has none; an imported target with no planning copy reads as today.

## What it costs to change later

A constant in one file and two test lines: changing the words costs minutes, and the sync step matches only their opening.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the person running the sync step reads 'read at its copy' as natural English (author)
