---
id: s3-02-way-back-reads-through-a-route
prd: 1318
slice: s3
rank: medium
bears-on: none
raised: 2026-10-09
wave: 3
---

## The question, in plain words

After someone answers a question opened from a PRD page, the page goes back to the next open question there, which it read straight from the database. With the database gone from the page, where should that read go?

## The decision, in plain words

The page reads which of the PRD's questions are still open through a new read of its own on the server, which hands back only whether each is open and when it was asked.

## The intro, for fun

The way home needed a map, and the map was kept in the database.

## The punchline, for fun

Now the server reads it out, one street name at a time.

## The options, in plain words

A. As built: a read of its own that hands back only which questions are open and when each was asked.
B. Fold it into the question's own read, which then carries the PRD's open questions when the page was opened from one.
C. Drop the read: after an answer the page goes back to the PRD's questions without jumping to the next open one.

## What I had to decide

GET /api/ask/dossiers/:id/rounds → {rounds: [{round_id, status, created_at}]}, a new route the plan does not list, in ask.controller.ts (401 signed-out first, 422 for an id that is no dossier's, 500 database), through askWayBack in ask.service.ts and wayBackRepository in ask.repository.ts, which calls the dossier area's dossier_rounds() reader. It replaces the browser client src/ask/page/back.ts used.
Decided by: Jev (hardToRevert 0.42) · agent said false

## What I did meanwhile

The question page reads it once after its answer, as before; the demo still goes to the Questions tab alone.

## What it costs to change later

Folding it into GET /api/ask/rounds/:id later is a query parameter and a field in the contract: no stored change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan lists the ask pages' three reads and their writes; the way back's dossier read is neither, and the page could not keep its browser client.
