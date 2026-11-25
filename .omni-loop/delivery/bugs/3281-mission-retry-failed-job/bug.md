# Bug 3281: a mission's failed plan or tech-review job goes to a person instead of being run again

## Triage

- **Domain:** missions: the PM's product PRDs before their build (`apps/omni-app/src/missions/tech.ts`, `reviewStateOf`)
- **Risk:** high — every mission whose plan job or Architect review fails or leaves no record stops on a person, who must approve each PRD by hand; resuming does not retry (Jev, 0.86)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/omni-app/src/missions/tech.retry.test.ts`
- **Level:** unit
- **Red:** `AssertionError: expected { state: 'waits', …(1) } to deeply equal { state: 'tech', k: 2 }`

## Fix

A plan job or an Architect review of a PM product PRD that failed or ended with no record was recorded escalated and sent the PRD to a person at once, so a mission stopped on its person for a job that decided nothing (mission #3270). Such a job is still recorded escalated and never approved (BL-GATE-1), but the fleet now sends it again while its two rounds last, with its own event sentence, and a person gets the PRD only once its rounds are spent or a job that ran chose to escalate. Acceptance criterion AC-4 of PRD omni-loop-26 changes with it, as its owner decided on 2026-11-25: its tests now cover the retry, then the person.

## Guard

The reproduction, plus AC-4's job and end-to-end tests: one review that left no record sends the Architect again, and two send the PRD to a person.

## Mutation

mutation: no changed core file against origin/main: nothing to mutate
