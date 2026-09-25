---
id: s2-01-stop-or-blocked-writes-nothing
prd: 7
slice: s2
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

When a recorded decision cannot proceed on its own, should the command still write the item file the underlying policy says it would, or write nothing at all?

## The decision, in plain words

The command writes nothing and just prints why, even for the one case where the policy itself would normally write a high-ranked item naming the conflict.

## The options, in plain words

A. Write nothing at all for a stop or a blocked outcome, and only print the reason, the option built.
B. Follow the underlying policy exactly: still write the item file for the one stop case it marks as writing one, and only skip writing for the other.

## What I had to decide

Whether omni item new writes an item file for a stopped or blocked decision, or only prints the reason and exits.

## What I did meanwhile

Nothing is written for a stop or a blocked outcome; only the reason is printed, and the caller decides what to do next.

## What it costs to change later

One conditional branch to remove, plus a render call to add back, if a later reviewer wants the file written after all.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- the instruction that shaped this command said plainly to write nothing on a stop or a blocked outcome, even though the underlying policy function marks one of those two cases as writing an item
