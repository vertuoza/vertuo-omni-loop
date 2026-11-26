# Bug 3369: after the fleet answered a product PRD's red gate, builds that ended red before its answer stop the mission

## Triage

- **Domain:** missions: a product PRD's red gate at Works alone (`apps/omni-app/src/missions/supervisor.ts` › `redCleared`, `apps/omni-app/src/missions/store.ts`)
- **Risk:** medium — a mission at Works alone waits on a person after the fleet's committee answered a product PRD's items, instead of sending its build again; workaround: a person sends the build by hand. (Jev, 0.97)
- **Regression:** yes — #3364 (bug #3363): `redCleared` counted every build of the PRD that ended on its red gate, those that ended before the committee answered included

## Reproduction

- **File:** `apps/omni-app/src/missions/job.product-committee.test.ts`
- **Level:** unit
- **Red:** `AssertionError: expected [ …(2) ] to deeply equal [ …(2) ]` (the latest build stayed `mission:…:prd:omni-loop-28:run:4`: no run 5 was sent once the committee answered s1-02-parts-live-in-omni-ui with option A)

## Fix

Once the fleet's committee carried or deferred every open item of a product PRD's red gate, the mission sent the build again only while fewer than 2 of its builds had ended red, counting the builds that ended red before the committee existed (mission #3319: omni-loop-28's runs 1 to 4, omni-loop-29's latest build). The store now reads when each product build and each item committee was queued, and only a build queued after the PRD's latest answered committee, ending red again, sends it to a person; no build is sent while a committee decides, so that build was sent after the fleet answered. When those times do not read, the rule stays as it was (2 reds).

## Guard

The job-level cases on omni-loop-28's shape in `apps/omni-app/src/missions/job.product-committee.test.ts` (4 red builds before the committee answers: run 5 is sent; run 5 red again: a person), and the store's read of `queued_at` in `apps/omni-app/src/missions/store.product.test.ts`.

## Mutation

mutation: no delivery-core file changed, nothing to mutate
