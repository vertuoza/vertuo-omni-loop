---
id: s4-01-bugs-pick-as-resumed-or-stopped
prd: 3001
slice: s4
rank: medium
bears-on: none
raised: 2026-11-17
wave: 2
---

## The question, in plain words

When a bug survives QA's second check, a person picks between sending the work on to the reviewer and stopping it, and the database has no place made for that pick. Where should the pick be written so the mission can read it?

## The decision, in plain words

The pick is written as one more line in the mission's history, signed with the person's name: 'resumed' for the work, to send it on, or 'stopped' for it, to stop it, each naming QA's second check. The mission reads the first such line and acts on it.

## The intro, for fun

A person makes a call, and the database has no drawer to keep it in.

## The punchline, for fun

So it goes in the diary, signed, like every other call.

## The options, in plain words

A. Write the pick as a resumed or stopped row of the PRD, naming QA's second check and signed by the person.
B. Add a new kind of row for the pick, in a migration of its own, and read that instead.
C. Keep the pick on the mission itself, in a new column, and read it there.

## What I had to decide

How a person's pick on Decide the bugs is recorded, so that s4's supervisor reads it and s5's mission page writes it. Taken in apps/omni-app/src/missions/qa.ts (picksOf): a mission_events row of kind `resumed` (Send on to the Reviewer) or `stopped` (Stop this PRD), with prd set to the PRD, job_id set to QA's round-2 job, role supervisor and actor the person's login. The first such row for a job wins. The supervisor's own `stopped` rows name no job and the mission's own `resumed` rows name no PRD, so neither reads as a pick; repair.ts roundOf now opens a new repair round only on a `resumed` with no PRD. The person's `stopped` row also stands for the PRD's stop: its key `stopped:<prd>` keeps the supervisor from recording a second one. No migration: s2 was the only slice allowed one, and the kinds already exist.

## What I did meanwhile

Built and tested this way (qa.test.ts, qa.e2e.test.ts, with store.fake.ts's pickBugs recording the row as the page would). s5 writes the row with the service role as the page records a drop ask today.

## What it costs to change later

Reading the pick from another kind or a new column means one function (picksOf) and one test here, and the row s5 writes; a new kind would need a migration adding it to mission_events_kind_check.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether a person would rather see a pick of its own name in the Operation room's history than a resume or a stop of the PRD
- (author) the PRD, the registers and the glossary do not say how a person's pick on a mission is stored
