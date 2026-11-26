# Bug 3345: a mission's product build held on another PRD is resent and repaired instead of waiting for it

## Triage

- **Domain:** missions: the supervisor of product PRDs (`apps/omni-app/src/missions/supervisor.ts` › `productStateOf`, `apps/omni-app/src/missions/store.ts` › `products`)
- **Risk:** medium — a mission at Works alone burns builds and repairs on a product PRD whose blocker has not joined yet, then stops on a person; workaround: a person waits for the blocker and takes the PRD by hand.
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/omni-app/src/missions/job.product-held.test.ts`
- **Level:** unit
- **Red:** `AssertionError: expected [ …(5) ] to deeply equal [ …(3) ]` (the held builds of omni-loop-30 and omni-loop-31 sent again as run 2 at once, before omni-loop-28 joined)

## Fix

A product PRD's blockers came only from a product roadmap, and an `/omni:ultra-yolo` job ends with no result word, so a build held on another PRD read as a stop mid-way: it was sent again, then repaired. The store now adds the PRDs of the scope that the spec's `blocked-by` names, and reads from an ended build's log the PRDs its held line names and whether it ended on its red gate (`held.ts`). A build that ended while what it waits on is off the branch is blocked, and the builds sent before that PRD joined, with the repairs sent for them, count nothing; it is sent again as its next run once the PRD joined. A held line naming only PRDs outside the scope waits on a person. A build that ended on its red gate waits for its open items and is sent again once none is open. `/omni:ultra-yolo` now ends such a hold on a defined `held:` line.

## Guard

`apps/omni-app/src/missions/held.test.ts` (the held line, the spec's `blocked-by`, the red gate, the builds sent early, the repairs that count none) and the job-level cases of the reproduction, on mission #3319's shapes: held builds, 9 repairs spent on held builds, and a red gate.

## Mutation

mutation: no changed core file: nothing to mutate

## Still open

- The fleet's committee answers only a repository PRD's high items: a product PRD's build that ends on its red gate waits for a person to answer its items on its page, since /omni:committee takes no product PRD.
