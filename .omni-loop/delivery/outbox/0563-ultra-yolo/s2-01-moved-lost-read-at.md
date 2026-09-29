---
id: s2-01-moved-lost-read-at
prd: 563
slice: s2
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

When the other repository no longer has the exact version the plan was written against, what does the moved check say about it?

## The decision, in plain words

It says the repository could not be read, with the reason, rather than guessing whether anything moved.

## The intro, for fun

The bookmark is still here, but somebody tore out the page it was marking.

## The punchline, for fun

So we say we lost our place instead of pretending we finished the chapter.

## The options, in plain words

A. A. unreachable, with the reason in the detail (built)
B. B. moved, with every file under the territories counted as changed
C. C. a fourth state, lost, which ultra-yolo would record like a moved target

## What I had to decide

Whether a target whose read at commit can no longer be compared with its default branch is reported as unreachable, as moved, or as something new.

## What I did meanwhile

omni plan moved reports such a target as unreachable, its detail naming the read at commit that cannot be compared; the JSON keeps the three states the spec names.

## What it costs to change later

One branch in kit/lib/plan-repo/moved.mjs and one test; no stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec defines unreachable only as gh cannot read the target; a read at commit the target lost (a force-push or a rewritten history) is not covered, and folding it into unreachable is mine.
