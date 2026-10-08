---
id: s2-02-tick-from-any-commenter
prd: 1218
slice: s2
rank: medium
bears-on: none
raised: 2026-10-08
wave: 2
---

## The question, in plain words

When someone marks a hand-done prerequisite as done with a comment on the roadmap, whose comments should count?

## The decision, in plain words

Any comment carrying the done marker counts, whoever wrote it. The roadmap page only lets workspace members post it, and a tick on GitHub is visible to everyone who can see the roadmap.

## The intro, for fun

A checklist anyone can tick is either very friendly or very optimistic.

## The punchline, for fun

On a private repository, it is mostly friendly.

## The options, in plain words

A. A. Any marked comment counts (built).
B. B. Only a comment by someone with write access to the repository counts.
C. C. Only a comment posted through the Omni page or the tick command counts.

## What I had to decide

Whether a tick comment on the roadmap issue counts whatever its author, or only when its author can write to the repository.

## What I did meanwhile

readTicks reads every comment of the roadmap issue whose first line is the fixed marker <!-- omni-roadmap-tick: <id> -->, without looking at its author; the runner reads ticks for person rows only, so a tick never frees a row a check verifies.

## What it costs to change later

Filtering by author later is one more field read from the comment and a permission lookup in the command: no stored shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the page's tick is for a signed-in member, but says nothing of who may post the same comment on GitHub directly.
