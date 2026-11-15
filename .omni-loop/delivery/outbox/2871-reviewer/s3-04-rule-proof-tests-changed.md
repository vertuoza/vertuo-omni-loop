---
id: s3-04-rule-proof-tests-changed
prd: 2871
slice: s3
rank: high
bears-on: none
raised: 2026-11-15
wave: 2
---

## The question, in plain words

Five existing checks that prove the product's rules for missions, the runner and virtual fleets were changed so they also expect the new review step. Do you accept these changes to the rule checks?

## The decision, in plain words

The checks were extended, not loosened: each old expectation still holds, and the new review endings, the new mission event and the Reviewer's skills are now checked too. Builds are now sent with the review flag, so the expected lines say so.

## The intro, for fun

Five rule checks learned a new word overnight: review.

## The punchline, for fun

Nobody forgot the old words; they just stopped being the only ones.

## The options, in plain words

A. A. Accept the five changed checks as built (extended to cover the review step).
B. B. Undo them, and rework the review step so the old checks pass unchanged.

## What I had to decide

Accept or undo the changes to the five rule-proof checks: kit/lib/runner/runner.test.ts (N-PRODUCT-19, +24 lines, nothing removed), supabase/checks/missions.sql (BR-PRODUCT-137/138: the kind list grows from eleven to twelve, the read counts grow with the Reviewer's job), supabase/checks/virtual_fleets.sql (BR-GAME-1..3: the Reviewer's default skills go from {} to {review}), apps/omni-app/src/missions/supervisor.test.ts and mission.e2e.test.ts (BR-PRODUCT-139: builds are sent as /omni:yolo <n> --for-review). Raised high at the person's request, because these rules are proposed and the kit ranks the change medium on its own.

## What I did meanwhile

The checks pass as changed; the feature PR stays a draft until this is answered.

## What it costs to change later

Undoing means reverting the review step in missions, the runner and the Reviewer's defaults: the whole PRD's wiring.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The rules these checks prove are proposed, not confirmed: no owner is named to approve them (author)
