---
id: s3-03-an-impossible-prd-number-reads-as-none
prd: 1049
slice: s3
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

When a number that no real PRD can have reaches the arcade from a source it reads leniently (a rule's source line, a planet's link, the waiting list), should the arcade fail, or treat it as naming no PRD?

## The decision, in plain words

Those lenient readers treat such a number as naming no PRD, as they already did for text that names none. Stored rows and incoming requests still fail loudly on one, as the plan asks.

## The intro, for fun

Somewhere, a rule claims to come from PRD zero.

## The punchline, for fun

The knowledge map politely pretends it never said that.

## The options, in plain words

A. Lenient readers treat an impossible PRD number as none; strict entry points refuse it (built).
B. Every reader refuses it, so one bad source line hides the whole knowledge map.

## What I had to decide

Some reads were lenient before the brands: the knowledge map's `PRD #<n>` source lines (read bare by the kit), a planet's link `#planet-<n>`, the history filter `?prd=`, and the waiting list's outbox items read in the browser. A branded parse of a number like 0 throws; throwing there would blank the whole knowledge map or break the page for one bad line.

## What I did meanwhile

Those four readers use the schema's safe parse: a number that is not a PRD number reads as none (the map entry shows no PRD, the link opens the map, the filter is dropped, the item is skipped). Rows from Supabase, GitHub payloads, the proof, dossier and stage-event APIs and the short address parse strictly, as the database's own checks (`prd > 0`) already hold.

## What it costs to change later

One line per reader: swapping the safe parse for the throwing one.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether s5, when the kit's knowledge reader returns a branded number, keeps the lenient reading (author).
