---
id: s3-02-main-reads-wired-outside-territory
prd: 2410
slice: s3
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

The page can only show a PRD's main status if its page code asks the database for it, and that code sits just outside this slice's list of files. Should the slice touch it?

## The decision, in plain words

The slice adds one read line to the page's loader and its streaming wrapper, and nothing else there, so the new status and tab have data to show.

## The intro, for fun

The status was ready; the pipe that carries it lived next door.

## The punchline, for fun

It borrowed two lines of the neighbour's wall and left the rest alone.

## The options, in plain words

A. Add the one read to the route and its streaming wrapper (built).
B. Leave them alone and ship the status with no data, for a later slice to wire.

## What I had to decide

Whether to add the watch read to the files that load the PRD page (the route and its streaming wrapper), which the slice's file list does not name.

## What I did meanwhile

Added one optional read to DossierRoute.tsx and to stream/DossierStream.tsx, each a few lines, with no other change there.

## What it costs to change later

Reverting the two small edits removes the data; the status and tab then stay hidden, as for an unwatched PRD.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the plan lists the page, its view and its head, but not the loader that feeds them
