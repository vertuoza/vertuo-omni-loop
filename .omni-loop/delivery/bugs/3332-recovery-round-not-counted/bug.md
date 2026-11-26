# Bug 3332: a PM round that only re-approved the same plan after the Architect's failed reviews counts toward its rounds

## Triage

- **Domain:** missions — the PM product PRD's plan and tech review rounds (`apps/omni-app/src/missions/tech.ts`)
- **Risk:** medium — a mission at `alone` stops on a person when its PM could answer the Architect's open points itself; workaround: the person sends the PRD back or approves it on its page
- **Regression:** yes — #3327 (bug #3326) added the PM's recovery plan job after the Architect's no-record reviews, and `decidedOf` counted that re-approval of the same version as one of the PM's rounds

## Reproduction

- **File:** `apps/omni-app/src/missions/tech.recovery.test.ts`
- **Level:** unit
- **Red:** `× sends the PM's plan job with the Architect's open points, not a person` (received `{ state: 'waits', why: 'PRD omni-loop-28: the Architect left it to you: PM: spec Solution, …' }`)

## Fix

The PM's plan job the mission sends after the Architect's reviews left no record only re-approves the version the PM had approved before them, yet it counted as one of the PM's two rounds, so the Architect's first real open points went to a person. A plan decision that re-approves, right after jobs that left no record, the version the PM's previous approval named is now a recovery, not a round (`roundsOf`); the recovery itself stays capped by every plan decision, as before, and a re-approval that answers open points still counts.

## Guard

The reproduction on omni-loop-28's exact history, plus two bounds: the PM's answer and a second escalation still reach a person, and a re-approval of the same version after open points counts as a round.

## Mutation

mutation: no changed core file against origin/main (f36bd747): nothing to mutate
