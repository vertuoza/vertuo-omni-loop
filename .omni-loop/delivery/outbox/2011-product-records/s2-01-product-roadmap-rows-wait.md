---
id: s2-01-product-roadmap-rows-wait
prd: 2011
slice: s2
rank: medium
bears-on: none
raised: 2026-10-15
wave: 2
---

## The question, in plain words

When a roadmap is written on the server, what does each of its PRDs say about where it stands, and is its people-work sent too?

## The decision, in plain words

A product roadmap sends every row as waiting, with no start or end date, and sends no human work, so a push closes none of it. The page and the drive loop that come later read the real standing of each PRD from the server.

## The intro, for fun

The roadmap is written before anyone has started building.

## The punchline, for fun

Every bar starts grey, and the later slices colour it in.

## The options, in plain words

A. A. Send every row as waiting and no human work, leaving standing to the pages that read the server (as built)
B. B. Read each PRD's standing from the server at push time and send it with the rows
C. C. Send the person questions as human work now, and leave the standing for later

## What I had to decide

Whether a product roadmap's push should already carry each PRD's standing and the unanswered person questions, as a git-born roadmap's does.

## What I did meanwhile

The kit sends state waiting, no waits-on line and no dates for each row, answers null for each question and leaves humanWork out, so the database keeps any human work it already has. A product PRD has no feature branch in this checkout to read, and the pages that show standing are the next slices.

## What it costs to change later

A constant in the body builder in the kit's roadmap push file, plus a read of each PRD's standing from the server; no stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say whether a server-born roadmap's rows carry a standing at push time or are read when the page opens.
