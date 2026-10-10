---
id: s2-01-unreadable-base-reads-unknown
prd: 1369
slice: s2
rank: medium
bears-on: none
raised: 2026-10-10
wave: 2
---

## The question, in plain words

When the check cannot read the branch it compares against, should it say it does not know, or stop with an error?

## The decision, in plain words

It says it does not know whether a screen changed, names the branch it could not read, and carries on, so the agent judges from the change itself.

## The intro, for fun

The check went looking for the branch to compare against and found an empty shelf.

## The punchline, for fun

So it shrugged politely instead of slamming the door.

## The options, in plain words

A. A. Print ui: unknown with the base it could not read, exit 0 (built)
B. B. Stop with a usage error, exit 2, as omni generated does
C. C. Fetch the base first, then fall back to A

## What I had to decide

Whether a missing comparison branch is an unknown answer or a usage error.

## What I did meanwhile

omni design touched prints ui: unknown and a line naming the base it could not read, and exits 0; a wrong number of arguments still exits 2.

## What it costs to change later

A constant: switching to an error is a one-line change in kit/bin/commands/design.ts and its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the command always exits 0 and lists the four answers, but does not say what a base git cannot read prints (author).
