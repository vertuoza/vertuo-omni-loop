---
id: s9-14-route-notation-and-bracketed-paths
prd: 1407
slice: s9
rank: medium
bears-on: none
raised: 2026-10-10
wave: 6
---

## The question, in plain words

Screen files name their addresses and files in a short list form, and a file path with square brackets, as our framework writes a page with a changing part, breaks that list without a clear message, and addresses are written three ways across the kit. Should the kit settle one way and explain the failure?

## The decision, in plain words

The bracketed path was put in quotes, and addresses are written with a placeholder in angle brackets.

## The intro, for fun

The address had a bracket in it, and the post office returned the letter.

## The punchline, for fun

The stamp said only that the envelope was the wrong shape.

## The options, in plain words

A. Quote the path and write addresses with angle brackets (built)
B. Settle one notation for addresses and explain the quoting in the refusal
C. Read addresses from the router instead of writing them by hand

## What I had to decide

Not built here: the dogfood records it for a person to decide whether it becomes a follow-up PRD. The fix it would make: the screen reader's refusal says to quote a path holding brackets; the screen format names one notation for a route's changing part (the router's own, or :name), and touched and the review read it; the spec's and the guide's examples use it.

## What I did meanwhile

Nothing of the kit changed in this slice. prd-dossier.md quotes "apps/galaxy/app/prd/[id]/" and routes /prd/<id>; the spec shows /quotes/:id; the router declares app/prd/[id]/. The finding and its evidence are in .omni-loop/delivery/inbox/1407-design-memory/dogfood.md.

## What it costs to change later

A constant: a follow-up PRD adds the concept, or this item is dropped. Nothing written here needs a migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Which notation the review needs to open a route with a real id is not settled
