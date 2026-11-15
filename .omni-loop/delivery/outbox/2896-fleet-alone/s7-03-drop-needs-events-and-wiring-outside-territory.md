---
id: s7-03-drop-needs-events-and-wiring-outside-territory
prd: 2896
slice: s7
rank: medium
bears-on: none
raised: 2026-11-15
wave: 7
---

## The question, in plain words

Dropping a PRD needs new kinds of mission event, a call from the terminal and one line wiring the drop into the job list, none of them in the slice's territory. Were they right to change?

## The decision, in plain words

A new database migration lets a mission record that a drop was asked for and done, the terminal's client gets one call for it, and the job list gets the new drop step. Each is small and only adds.

## The intro, for fun

To take a PRD off the branch you first have to be allowed to say so.

## The punchline, for fun

Four paths outside the fence, each one just a door.

## The options, in plain words

A. Keep the additive migration, client call and job wiring as built.
B. Record a drop another way, with no new event kind, and rework the slice.

## What I had to decide

Add supabase/migrations/20270123120000_mission_drops.sql and its proof in supabase/checks/missions.sql, add dropMission to kit/lib/ask/client.ts, and wire missionDrops in apps/omni-app/src/jobs/pr-checks.ts, all outside the slice's territory.

## What I did meanwhile

The three event kinds are additive, the client call is one method, and the wiring is one line, the same as s4 to s6 did.

## What it costs to change later

Reverting means a follow-up migration that only works while no drop is recorded, and removing one method and one line.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gave the slice no migration, client or job-list path, yet a drop must be recorded and reachable from the terminal.
