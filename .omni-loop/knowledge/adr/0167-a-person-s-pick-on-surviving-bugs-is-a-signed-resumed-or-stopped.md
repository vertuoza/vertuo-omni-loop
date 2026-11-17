# ADR-0167 — A person's pick on surviving bugs is a signed resumed or stopped mission event naming QA's second check

**Status:** adopted · **Date:** 2026-11-17 · **PRD:** #3001 · **Decided:** nobody — adopted when raised (medium), 2026-11-17 · **Merged:** @pierrederval, 2026-11-17, PR #3002

## Context

How a person's pick on Decide the bugs is recorded, so that s4's supervisor reads it and s5's mission page writes it. Taken in apps/omni-app/src/missions/qa.ts (picksOf): a mission_events row of kind `resumed` (Send on to the Reviewer) or `stopped` (Stop this PRD), with prd set to the PRD, job_id set to QA's round-2 job, role supervisor and actor the person's login. The first such row for a job wins. The supervisor's own `stopped` rows name no job and the mission's own `resumed` rows name no PRD, so neither reads as a pick; repair.ts roundOf now opens a new repair round only on a `resumed` with no PRD. The person's `stopped` row also stands for the PRD's stop: its key `stopped:<prd>` keeps the supervisor from recording a second one. No migration: s2 was the only slice allowed one, and the kinds already exist.

## Decision

A person's pick after QA's second check is written as a mission_events row of kind resumed (send on to the reviewer) or stopped, naming the PRD and QA's round-2 job and signed with their login. The first such row for a job wins, so no migration is needed.

The option chosen: A. Write the pick as a resumed or stopped row of the PRD, naming QA's second check and signed by the person.

## Consequences

Reading the pick from another kind or a new column means one function (picksOf) and one test here, and the row s5 writes; a new kind would need a migration adding it to mission_events_kind_check.

## Source

`.omni-loop/delivery/shipped/3001-qa-turn/outbox/settled.md`, entry `s4-01-bugs-pick-as-resumed-or-stopped`
