# Bug 3324: at alone, a mission's product PRDs its PM did not write wait on a person instead of the fleet's plan and approval

## Triage

- **Domain:** missions: the product PRDs' plan and review flow (`apps/omni-app/src/missions/job.ts`, `tech.ts`)
- **Risk:** medium — a mission at alone whose scope holds product PRDs its PM did not write stops on each until a person writes its Repositories table or approves it on its page; the workaround is doing that by hand (Jev, 0.98)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/omni-app/src/missions/job.fleet-owned.test.ts`
- **Level:** unit
- **Red:** `× a plan with no Repositories table goes to the PM's plan job, not to a person` — `AssertionError: expected [] to deeply equal [ Array(1) ]`

## Fix

The mission ran the PM's plan job and the Architect's review (PRD omni-loop-26) only for the product PRDs this mission's own PM wrote, so at alone a product PRD of the scope written by a person or by an earlier mission's PM waited on a person for its Repositories table or its approval. As the owner decided ("the fleet must be independent and do what is needed"), at alone every product PRD of the scope, its roadmaps' rows among them, is now the fleet's (`fleetOwns` in `job.ts`): the PM plans it and approves the plan, the Architect reviews it, and the fleet's approval lets it build, with the same rounds and caps. One that already holds a standing approval and a plan with its table is built as before, and below alone nothing changes; the PM's dispatch sentence no longer says it wrote a PRD it did not.

## Guard

The reproduction is the guard: `job.fleet-owned.test.ts` drives the mission job through #3319's shape (no table → the PM's plan job; a table and no approval → plan, review, the fleet's approval, the build into the mission branch; a standing approval → built at once) and checks own-branch is unchanged.

## Mutation

pending

## Still open

- Under --mission, the PM's plan-only run and the Architect's review still name their PRD one the mission's PM wrote, and the PM may reword a spec a person wrote to answer the Architect's open points.
