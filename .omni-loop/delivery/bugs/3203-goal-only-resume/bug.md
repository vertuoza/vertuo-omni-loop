# Bug 3203: a goal-only mission whose PM wrote no PRD shows Pause, not Resume, and cannot make the PM try again

## Triage

- **Domain:** missions: the Missions tab's row, Resume, and the PM's job (`apps/galaxy/src/missions/`, `apps/omni-app/src/missions/pm.ts`)
- **Risk:** medium — a person whose goal-only mission's PM wrote no PRD cannot make it try again; the only workaround is a new mission with the same goal
- **Regression:** new bug — no evidence this ever worked (shipped with the gap in #3185, recorded as item s6-01 of omni-loop-24)

## Reproduction

- **File:** `apps/omni-app/src/missions/mission.goal.e2e.test.ts`
- **Also:** the `#3203` cases of `apps/galaxy/src/missions/missions.service.test.ts` and `apps/galaxy/src/missions/page/missions-tab.test.ts`
- **Level:** unit
- **Red:** `AssertionError: expected [ …(2) ] to deeply equal [ …(3) ]` (the supervisor sent no third roadmap after the person's Resume); `AssertionError: expected { ok: false, kind: 'conflict', …(1) } to deeply equal { ok: true, …(1) }` (Resume refused a waiting mission); `AssertionError: expected 'pause' to be 'resume'` (the row)

## Fix

The row of a goal-only mission waiting on `the PM wrote no PRD for the goal` now offers Resume instead of Pause, and Resume moves that one waiting mission to running, recording `<login> resumed the mission: the PM is sent the goal once more.` The supervisor counts each such Resume, recorded once the PM's jobs were spent, as one more round: it sends the same `/omni:roadmap --mission <m> --cap <k>` (or mega-roadmap) line under the next round, and if that writes no PRD the mission waits again with its reason.

## Guard

Unit tests of `pmAsks` in `apps/omni-app/src/missions/pm.test.ts`: a Resume counts one round only once the PM's jobs were spent, never while one works, never for a PRD's own resume, two in one wait count one; and `pmNext`/`pmWait` send the next round and wait again after it.

## Mutation

mutation: no changed core file against origin/main (56a9d1a9): nothing to mutate
