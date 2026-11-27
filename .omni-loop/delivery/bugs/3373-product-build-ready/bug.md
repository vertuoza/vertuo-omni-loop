# Bug 3373: a mission never joins a product build that ended ready and sends it again

## Triage

- **Domain:** missions — a product PRD's build end (apps/omni-app/src/missions/held.ts, supervisor.ts; kit/lib/runner)
- **Risk:** medium — every mission with a product PRD: a build that ended ready is never joined and is sent again until its tries and repairs run out; the workaround is joining it by hand (Jev, 0.61)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/omni-app/src/missions/job.product-held.test.ts`
- **Level:** unit
- **Red:** `AssertionError: expected [] to deeply equal [ 'omni-loop-28' ]`

## Fix

The runner gives an `/omni:ultra-yolo` job no result word, so the mission read a product build that ended on `/omni:mega-pr-care <id>` (its target PRs ready) as one that stopped mid-way and sent it again, then repaired those resends until the mission's repairs were spent. The mission now reads that last line as ready, joins a PRD once any of its builds ended ready (through the mission branch's merge gate, after its latest build ended), and counts none of the resends and repairs sent from that ready end on. The runner also reports `ready` for an ultra-yolo or ultra-yolo-fix job that ends on that line; its red gate and held line stay unworded, since the mission reads those from the log.

## Guard

The tests on omni-loop-28's exact end, in the mission run (`job.product-held.test.ts`), in `held.test.ts` and in the runner (`kit/lib/runner/runner.test.ts`): each ending /omni:ultra-yolo prints is read by both sides.

## Mutation

mutation: no changed core file against origin/main (e9e8e3cc): nothing to mutate
