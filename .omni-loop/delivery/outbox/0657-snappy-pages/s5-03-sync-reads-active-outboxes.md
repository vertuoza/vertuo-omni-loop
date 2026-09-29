---
id: s5-03-sync-reads-active-outboxes
prd: 657
slice: s5
rank: medium
bears-on: none
raised: 2026-09-29
wave: 3
---

## The question, in plain words

To keep the counts fresh, the quarter-hourly refresh now asks GitHub for the outbox of every PRD being built or waiting on its outbox, which spends some of the app's hourly GitHub allowance. Is that the right trade?

## The decision, in plain words

Every quarter hour, the refresh reads GitHub once for each PRD being built or waiting on its outbox, and stores zero for all the others without asking GitHub.

## The intro, for fun

The list stopped phoning GitHub on every visit, so now the night watch phones on a schedule instead.

## The punchline, for fun

Fewer calls overall, but the watch still has a phone bill.

## The options, in plain words

A. Recount every PRD at building or outbox on each quarter-hourly run (built).
B. Recount only on stage events and Sends, and let the quarter-hourly run store zero for PRDs that left building or outbox.
C. Recount on each run, but at most once an hour per PRD.

## What I had to decide

Whether the stages sync reads the GitHub summary of every PRD at building or outbox on each 15-minute run, as built, or only when a stage event or a Send says something changed.

## What I did meanwhile

The sync recounts each repository's PRDs after recording their stages: a PRD at building or outbox costs one GitHub summary (about 12 to 20 requests, config shared per repository by s6), any other stores 0 with no request. A summary that cannot be read keeps the stored count. With five such PRDs this is roughly 400 requests an hour, against the App's 5000 per installation.

## What it costs to change later

Changing when the sync recounts is a code change in the sync alone; nothing stored changes shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) How many PRDs sit at building or outbox at once on production was not measured, so the real share of the GitHub budget is an estimate.
