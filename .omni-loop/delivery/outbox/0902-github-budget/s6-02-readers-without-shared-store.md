---
id: s6-02-readers-without-shared-store
prd: 902
slice: s6
rank: medium
bears-on: none
raised: 2026-10-05
wave: 3
---

## The question, in plain words

The background sync and the business draft build their own copies of these GitHub readers, in files this slice may not change, so their calls go through the budget-aware door without the shared record of the budget. Who connects them to that record?

## The decision, in plain words

I let each reader take the shared record as an option and gave it to the knowledge map's reader; the sync and the draft keep a door with no shared record until their own files are changed.

## The intro, for fun

Two readers came through the new turnstile without a ticket.

## The punchline, for fun

The turnstile counted them anyway, just in its own head.

## The options, in plain words

A. A. Connect the record where this slice may, and connect the sync and the draft in a small follow-up (built).
B. B. Connect the sync and the draft in this slice too, outside its ground, racing another slice of the same wave.
C. C. Make the readers find the shared record themselves, so no caller can forget it.

## What I had to decide

How the sync's and the draft's own knowledgeReader and repoReader instances, built in apps/galaxy/src/stages/sync/live.ts and apps/galaxy/src/business/draft/live.ts (outside s6's territory; the first is s4's in this same wave), get the shared store.

## What I did meanwhile

knowledgeReader and repoReader take an optional store (default none) and the knowledge reader a priority (default background). knowledge/github-server.ts passes githubStore() and interactive. The two live.ts files are unchanged, so their calls go through githubClient with no store: no shared ETags, budget or pause for them.

## What it costs to change later

One line in each live.ts: pass githubStore() (sync/live.ts already imports it). No stored shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether s4 wires the sync's knowledge reader while it is in stages/sync/ (author).
