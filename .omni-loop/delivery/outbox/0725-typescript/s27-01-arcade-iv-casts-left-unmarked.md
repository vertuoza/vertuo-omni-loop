---
id: s27-01-arcade-iv-casts-left-unmarked
prd: 725
slice: s27
rank: medium
bears-on: none
raised: 2026-10-01
wave: 5
---

## The question, in plain words

Should this part of the game site have every loose type shortcut labelled and every outside read checked now, or only what the stricter list checks and the database types need?

## The decision, in plain words

Only what the stricter list checks and the database types need was changed, as the spec's out-of-scope list asks. About 130 older type shortcuts stay unlabelled for the final clean-up step to decide.

## The intro, for fun

The plan said tidy the whole room; the spec said only touch the shelf.

## The punchline, for fun

So the shelf is spotless and the rest of the room waits for its turn.

## The options, in plain words

A. Leave the arcade's existing casts and reads as they are; s29 decides (what I built)
B. Mark every arcade cast with ts-allow in a follow-up before s29
C. Mark the casts and add Zod schemas at every outside read in the arcade

## What I had to decide

Whether the arcade's existing casts get a ts-allow mark (and its outside reads a Zod schema) in these slices, in the ratchet slice, or never.

## What I did meanwhile

apps/galaxy business, business-api, jev, proof, engineering and repositories now type-check with noUncheckedIndexedAccess (non-null assertions only, no output change) and the two pages that open a browser Supabase client pass Database to it; the four cast lines touched there carry a ts-allow mark. The other ~130 as/any lines in this territory's source, and its Supabase and fetch reads, are untouched.

## What it costs to change later

Cheap either way: adding a ts-allow comment to each line, or a schema at each read, changes no output and can be done by s29 or a follow-up in one pass.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether s29's guard will scan apps/galaxy, where these unmarked casts would then fail it
- (author) Whether the plan's per-slice 'casts marked' and 'outside reads parsed' rules were meant to bind the arcade slices, given the spec's out-of-scope line
