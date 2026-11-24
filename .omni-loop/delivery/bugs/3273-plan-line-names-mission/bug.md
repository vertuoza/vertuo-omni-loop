# Bug 3273: a mission's PM plan job prints its plan approval on only some runs

## Triage

- **Domain:** missions: the PM's plan job line (`kit/lib/virtual-fleet/pm.ts` `planJobLine`, `/omni:mega-brainstorm --plan-only`)
- **Risk:** medium — a goal-only mission's PRDs whose plan run printed no record wait on a person for a plan the PM did approve; the workaround is approving each by hand
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `kit/lib/virtual-fleet/pm.test.ts`
- **Level:** unit
- **Red:** `AssertionError: expected '/omni:mega-brainstorm --product omni-…' to be '/omni:mega-brainstorm --product omni-…' // Object.is equality`

## Fix

The PM's plan approval is the `omni plan:` record its plan run prints, and the skill printed it "on a runner, for a mission's PM only", which an agent cannot check: the line named no mission, and 3 of 7 runs of mission #3270 guessed no. The line now ends with `--mission <m>`, the app passes the mission's number, and the skill prints the record whenever the line carries it.

## Guard

none — the reproduction is the cheap check that would have caught it, a unit test that a product PRD's plan line names its mission

## Mutation

mutation: no changed core file against origin/main (dd8b2655): nothing to mutate
