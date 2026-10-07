# Bug 1167: a feature PR marked ready right after a push shows green CI without its tests ever running

## Triage

- **Domain:** CI — the `checks` workflow's concurrency (`.github/workflows/checks.yml`) and the loop's ready step (`/omni:yolo` §5 item 4, `/omni:yolo-fix`, `/omni:ultra-yolo`, `/omni:pr`'s Merging and ready)
- **Risk:** high — a person reviewing a ready feature PR sees it green and mergeable while its tests, lint, typecheck and fallow never ran, so red code can merge into main; the only workaround is noticing the missing checks and rerunning the cancelled run by hand. (Jev, 0.43)
- **Regression:** new bug — no evidence this ever worked: the shared `checks-${{ github.head_ref }}` group and the draft skip both date from #599, the workflow's first version.

## Reproduction

- **File:** `scripts/checks-workflow.test.ts`
- **Red:** AssertionError: expected 'checks-feat/people-ranking' not to be 'checks-feat/people-ranking' // Object.is equality

## Fix

A push and `gh pr ready` seconds apart start a draft `synchronize` run, which runs nothing, and the `ready_for_review` run together; in one branch-wide group with `cancel-in-progress`, the draft run cancelled the ready one (#1018: runs 37621312496 and 37621311961). The workflow's group now ends in `-draft` or `-ready`, so a draft run can never cancel a ready run while a newer push still cancels the ready run before it. Because the kit's skills also run in repositories whose workflows it does not own, `/omni:pr`'s Merging and ready now waits for the pushed commit's run before `gh pr ready`, reruns a cancelled `ready_for_review` run, and never counts a skipped or cancelled check as green; `/omni:yolo`, `/omni:yolo-fix` and `/omni:ultra-yolo` follow it.

## Guard

The `the concurrency group` tests in `scripts/checks-workflow.test.ts` resolve the workflow's group for a draft and a ready run of one branch and fail when they share it, or when a newer ready run would no longer cancel the one before it.

## Mutation

mutation: no changed core file against origin/main (1c139ef7): nothing to mutate
