# Bug 3326: a mission's Architect refuses a drifted product PRD, so a re-planned PRD goes to a person

## Triage

- **Domain:** missions: the PM's plan and the Architect's review of product PRDs (PRD omni-loop-26)
- **Risk:** medium — every mission at Works alone whose PM pushes a new plan version on an approved product PRD stops on a person instead of running alone; workaround: a person approves the PRD on its page (Jev, 0.90)
- **Regression:** yes — #3306 (bug #3304) made the PM push a new plan version on an already-planned PRD, which voids its approval (`drifted`), and the `--mission` review of #3257 (omni-loop-26) refuses every state but `inbox`

## Reproduction

- **File:** `apps/omni-app/src/missions/tech.drifted.test.ts`
- **Level:** unit
- **Red:** AssertionError: expected { state: 'waits', …(1) } to match object { state: 'plan', again: true }

## Fix

Under `--mission`, `/omni:tech-review` and the plan-only run of `/omni:mega-brainstorm` stop only on an `unreachable` PRD: a `drifted` one (its approval voided by a newer plan version) is reviewed and planned as one in the inbox, on the latest plan version; outside `--mission` nothing changes. In the Omni app (`apps/omni-app/src/missions/tech.ts`), a kind's failed or record-less jobs in a row count since the last decision that named a plan version, and once the Architect's two are spent the PM's plan job is sent once more while its rounds last, so a mission that hit the cap (mission #3319) sends the PM, then the Architect, again without a person. A failed job is still never approved (BL-GATE-1), and the PM's two rounds still end on a person.

## Guard

`kit/test/mission-drifted-plan.test.ts` fails on any `--mission` refusal of a drifted PRD in either skill, and `apps/omni-app/src/missions/tech.drifted.test.ts` replays mission #3319's history (the PM's approval of version V, two reviews with no record) and fails when it waits on a person.

## Mutation

mutation:changed: no delivery-core file changed

## Still open

- A mission PM's plan push from a runner is recorded on the PRD's page as a person's push: the runner's omni sign-in is a person's, so an agent's push is attributed to a person (never#10: an agent never acts in a person's name).
