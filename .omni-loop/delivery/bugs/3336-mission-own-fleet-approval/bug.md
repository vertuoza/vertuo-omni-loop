# Bug 3336: a mission's plan and tech approvals give it no approval when another mission already approved the same plan

## Triage

- **Domain:** missions: the fleet's approval of a product PRD (`mission_decide_plan()`, BR-PRODUCT-144)
- **Risk:** medium — a mission at alone that takes over a PRD another mission already approved waits for a person instead of sending the build; workaround: a person approves the PRD on its page.
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `supabase/checks/mission_product_prd.sql`
- **Level:** unit
- **Red:** `psql:mission_product_prd.sql:523: ERROR:  FAIL: the pair on the latest plan gave mission 27 no product approval while mission 26's was in force: {"why": [], "plan": "bbbb…", "latest": true, "outcome": "approved", "approval": null, …}`

## Fix

`mission_decide_plan()` skipped the product approval of a PM and Architect pair on the latest plan whenever any product approval in force pinned that plan, even another mission's, which the mission reads as none (BR-PRODUCT-144). Migration `20270129190000_mission_own_fleet_approval.sql` skips it only when the approval in force is this mission's or a person's, and gives once the approval it should have given to each live mission at alone left in that state (mission #3319 on omni-loop-31).

## Guard

The new cases of `supabase/checks/mission_product_prd.sql`, run by CI's supabase workflow on every pull request: a second mission's pair on a plan another mission approved gets its own approval, and a mission the old function left without one gets it from the migration, once.

## Mutation

Mutation: no delivery-core file changed (SQL and tests only)
