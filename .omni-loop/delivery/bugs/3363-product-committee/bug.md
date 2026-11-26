# Bug 3363: at Works alone, a product PRD's red gate waits for a person instead of the fleet's committee

## Triage

- **Domain:** missions: the fleet's committee on a product PRD (`apps/omni-app/src/missions/supervisor.ts` › `redGate`, `apps/omni-app/src/missions/answers.ts`, `kit/bin/commands/committee.ts`, the product gate `omni status <key>-<n>`)
- **Risk:** medium — a mission at Works alone stops on a person for each high item of a product PRD whose build ended on its red gate; workaround: a person answers them on the PRD's page. (Jev, 0.96)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/omni-app/src/missions/job.product-committee.test.ts`
- **Level:** unit
- **Red:** `AssertionError: expected [] to deeply equal [ Array(1) ]` (no `/omni:committee omni-loop-28 --item s1-02-parts-live-in-omni-ui --bound 0.6` job sent: omni-loop-28's red gate waited for a person)

## Fix

The committee's line, its record and the App's ask read a repository PRD's number only, and a product PRD's red gate always waited for a person. At Works alone, each open high item of a product PRD whose build ended on its red gate now goes to the committee (`/omni:committee <key>-<n> --item <id> --bound <b>`), which reads the item from the Omni page; the App records its decision for the mission branch only and settles nothing, so the item stays open on the page for a person (BR-PRODUCT-145). Once every item is carried or deferred the build is sent again, once: its gate, `omni status <key>-<n> --into <mission branch>`, reads a high item the mission's fleet answered for that branch as answered (the page's items route says so with `into`), and the PRD joins as any Ready build does. A person is asked only for what the committee sent to one, a human-action item, or a second red gate.

## Guard

`scripts/mission-lines-guard.test.ts` now holds the product committee's line (a new mission line the runners' contract refuses fails there first), beside the job-level cases on omni-loop-28's shape, the `--into` gate and the product committee in `kit/lib/outbox/server-verbs.test.ts`, and the route's `into` read in `apps/galaxy/src/outbox-items/`.

## Mutation

mutation: 110 killed, 4 survived in kit/lib/outbox/server-store.ts, kit/lib/outbox/store.ts (the 4 on lines this fix did not change)
