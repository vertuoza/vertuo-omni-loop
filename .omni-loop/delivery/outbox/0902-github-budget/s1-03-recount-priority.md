---
id: s1-03-recount-priority
prd: 902
slice: s1
rank: medium
bears-on: none
raised: 2026-10-01
wave: 1
---

## The question, in plain words

Only the scheduled sync's outbox recount now steps back when the GitHub budget is low, while the recounts after a stage event or a sent answer still read as if a person were waiting. Is that acceptable until the next slice rewrites the recount?

## The decision, in plain words

The sync's recount and fix refresh read as background work; the stage event's and the send's recounts keep reading as a person's request, because their code lies outside this slice and the next slice replaces it.

## The intro, for fun

Three doors lead to the same counting room.

## The punchline, for fun

Only one of them has the new 'please wait' sign so far.

## The options, in plain words

A. Leave the stage event's and the send's recounts interactive until s2 replaces them.
B. Have s2 pass background for the stage event's recount and keep the send interactive, as the spec asks.

## What I had to decide

The plan's done-when says the PRD reader is `interactive` from a page and `background` from a recount. The recounts of the stage event and of outbox send are wired in `apps/galaxy/src/stages/outbox/live.ts`, which is s2's territory, not s1's.

## What I did meanwhile

The reader takes a priority (`interactive` by default). `apps/galaxy/src/stages/sync/live.ts` passes `background` for the sync's recount and fix refresh. `recountLive` (stage event, outbox send) still reads at the default, `interactive`, so it may spend the budget below the 20% floor, but never past a pause.

## What it costs to change later

One argument in one file, which s2 rewrites anyway when the recount derives from the snapshot.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How often stage events arrive during a busy wave, and so how much of the budget their recounts spend below the floor (author).
