---
id: s5-02-main-tab-wiring-outside-territory
prd: 2410
slice: s5
rank: medium
bears-on: none
raised: 2026-10-23
wave: 3
---

## The question, in plain words

The findings list needed a few lines outside this slice's own files so the Main tab can show it: is that acceptable?

## The decision, in plain words

Yes: the findings are read for the page next to the watch, and the kit's client gained two small calls. Nothing else outside the slice's files changed.

## The intro, for fun

To show a list on a tab, somebody has to carry it from the database to the tab.

## The punchline, for fun

A few lines of plumbing, and the water runs the right way.

## The options, in plain words

A. A. Optional wiring in the four page files and the kit client (built).
B. B. Extend the main-watch store and its view to carry the findings, in s3's files.
C. C. Leave the page unwired and let s7 wire it.

## What I had to decide

The slice's territory lists MainPane and the new rewind folders, but the page reads its data in DossierRoute, DossierStream and view.ts, and DossierPage passes it on; the kit's HTTP calls live in kit/lib/ask/client.ts. To meet 'the Main tab lists the findings' the slice added one optional read and one prop in those four page files (apps/galaxy/src/dossier/page/DossierRoute.tsx, stream/DossierStream.tsx, view.ts, DossierPage.tsx) and two methods, readRewind and pushRewind, to client.ts. Every addition is optional and leaves the existing tests as they were. Decided by: Jev (hardToRevert 0.54) · agent said false

## What I did meanwhile

Added the wiring as optional fields so a page with no findings reads as before; no existing line changed meaning.

## What it costs to change later

Moving the findings read into the main-watch store instead would touch its recording test, which asserts the exact selects.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the plan names MainPane but not the files that carry its data, so the wiring's owner among s3, s5 and s7 is not stated
