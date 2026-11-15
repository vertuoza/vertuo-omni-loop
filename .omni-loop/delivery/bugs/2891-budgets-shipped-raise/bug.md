# Bug 2891: omni / budgets misses a shipped PRD's approved ceiling raise

## Triage

- **Domain:** the Omni GitHub App's `omni / budgets` check (`apps/omni-app/src/budgets-check/`)
- **Risk:** medium — a shipped PRD's feature PR stays red on `omni / budgets`, saying it belongs to no PRD, after a person agreed its ceiling raise; the only way past is merging over the red check (live: #2872, PRD 2871).
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/omni-app/src/budgets-check/budgets-check.test.ts`
- **Level:** unit
- **Red:** AssertionError: expected 'Needs a person\'s yes: this PR raises…' not to contain 'belongs to no PRD'

## Fix

The check looked for the pull request's PRD among the inbox folders only, so once `omni ship` had moved the PRD to `shipped/<nnnn>-<topic>/` (its ledger at `outbox/settled.md` inside), the PR belonged to no PRD and the agreed raise was never read. `prdOfPull` now lists the shipped folders too and snapshots the shipped folder whole, so the `git` store reads its ledger; `apps/omni-app/api/` is rebuilt.

## Guard

The reproduction: an end-to-end run of the check on a fake GitHub whose head holds the PRD and its settled raise under `shipped/`; it fails on main's code and passes with the fix.

## Mutation

mutation: no changed core file against origin/main (82afe8fb): nothing to mutate
