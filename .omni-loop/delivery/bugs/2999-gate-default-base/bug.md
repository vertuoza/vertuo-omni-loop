# Bug 2999: omni status <prd> passes a law change without --base

## Triage

- **Domain:** the outbox gate (`omni status <prd>`, `kit/bin/commands/status.ts`)
- **Risk:** medium — whoever runs the bare gate (`/omni:yolo` step 5 among them) gets a green on a branch that changes a law with no high item, and marks the feature PR ready; passing `--base origin/main` is the workaround
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `kit/bin/status-default-base.test.ts`
- **Level:** unit
- **Red:** `AssertionError: expected +0 to be 1 // Object.is equality`

## Fix

The gate graded the branch's changes only under `--base` or `--changes`; run bare, it read the open outbox items alone, so a law change with no item and no account passed. It now grades the range against `<repo.remote>/<repo.defaultBranch>` when no `--base` is given, and exits 2 naming that base when it cannot be read, as an unreadable `--base` already did. A product PRD's gate, read from the Omni page, reads a local range only under an explicit `--base`, as before.

## Guard

The reproduction itself, run by `pnpm test`: it fails on the default branch's gate and passes on the fix, beside a case that refuses an unreadable default branch rather than passing on no range.

## Mutation

mutation: no changed core file against origin/main (2ebe3a6b): nothing to mutate
