---
id: s10-01-the-targets-command-shares-the-read
prd: 1548
slice: s10
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

The command that lists a product's repositories had its own copy of the steps that read them from the Omni page. Is it fine that it now shares the one reading the board, the next step, the care and the flow commands use?

## The decision, in plain words

Yes, kept: the listing now calls the shared reading, so both say the same things the same way. It is outside this slice's own files, and changes nothing anyone sees.

## The intro, for fun

Two commands were reading the same list out loud, word for word.

## The punchline, for fun

Now one reads it and the other just nods along.

## The options, in plain words

A. Keep the shared read, as built.
B. Undo it and keep the listing's own copy of the reading.

## What I had to decide

Whether the change to kit/bin/commands/targets.ts, outside the territory, stays: its targetList now calls productTargetList from kit/lib/product/targets.ts instead of repeating the sign-in, server read and copy fallback. The duplicate was what fallow's audit refused.

## What I did meanwhile

targets.ts keeps its own usage error for a missing repo.slug and every printed line; its tests pass unchanged.

## What it costs to change later

A constant: reverting is putting the dozen lines back in targets.ts and accepting the duplication fallow refuses.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- One ordering edge: with neither ask.url nor repo.slug set, omni targets now stops on the missing slug first (exit 2) rather than on the missing Omni page (exit 1). (author)
