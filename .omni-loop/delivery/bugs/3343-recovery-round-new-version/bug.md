# Bug 3343: a PM recovery round after the Architect's no-record reviews counts toward its rounds when the PM changed the version

## Triage

- **Domain:** missions — the PM product PRD's plan and tech review rounds (`apps/omni-app/src/missions/tech.ts`)
- **Risk:** medium — a mission at `alone` stops on a person after a recovery round instead of the PM answering the Architect's open points; workaround: the person approves the PRD on its page
- **Regression:** new bug — no evidence this ever worked: #3333 (bug #3332) skipped only a recovery round that re-approved the same version

## Reproduction

- **File:** `apps/omni-app/src/missions/tech.recovery.test.ts`
- **Level:** unit
- **Red:** `× sends the PM's plan job with the Architect's open points, not a person` (received `{ state: 'waits', why: "PRD omni-loop-32: the Architect left it to you: PM: the sidebar's Settings entry already opens /app/settings; …" }`)

## Fix

The PM's plan job the mission sends after the Architect's reviews left no record twice is a recovery, yet when the PM pushed a new version during it, `roundsOf` counted it as one of the PM's two rounds, because #3333 recognised a recovery only by its unchanged version. A plan decision that follows a run of FAILS no-record reviews since the last decision that named a version is now a recovery, whatever version it names; the same-version rule of #3332 stays. The recovery itself stays capped by every plan decision, the failures by FAILS, and the PM's confirmation by #3335's once-per-version rule.

## Guard

The reproduction on omni-loop-32's exact history, plus three bounds: the PM's answer and a second escalation still reach a person, a second run of no-record reviews after a recovery reaches a person, and a new version after only one no-record review still counts as a round.

## Mutation

mutation: no changed core file against origin/main (a5bc8e56): nothing to mutate
