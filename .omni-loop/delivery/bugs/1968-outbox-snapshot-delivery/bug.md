# Bug 1968: the outbox check downloads the whole delivery folder and waits up to 100 minutes for the GitHub budget

## Triage

- **Domain:** the omni-loop GitHub App's outbox check (`apps/omni-app/src/outbox-check`, PRD 28)
- **Risk:** medium — every PR author waits 30 to 100 minutes for the outbox gate, and the snapshot is about 640 files from its 2,000-file bound, past which the check fails outright; the workaround is to wait. (Jev, 0.53)
- **Regression:** new bug — no evidence this ever worked; the cost grows with the delivery folder (1,187 files today)

## Reproduction

- **File:** `apps/omni-app/src/outbox-check/snapshot-scope.test.ts`
- **Red:** AssertionError: expected [ …(4) ] to deeply equal [] — the check fetched `head1:.omni-loop/delivery/bugs/0099-other/bug.md` and the three files of `shipped/0007-gadget`, another PRD's

## Fix

Each evaluation snapshotted every file of the head's delivery folder, one GitHub API call per file, though the gate reads only the folder names and the contents of the pull request's own PRD or fix folder. `snapshot` now takes `fetchIf`: a file it refuses is written empty under its name, never fetched and never counted against the bound, and the check fetches only the feature PR's `<nnnn>-<topic>` folders or the fix PR's `<nnnn>-` folder (`delivery-scope.ts`); a pull request of any other kind fetches everything, as before.

## Guard

The reproduction is the guard: it fails as soon as a check fetches a file of another PRD's or another fix's folder, and checks the verdict is the one the whole folder gave; unit tests cover `fetchIf` and the folder rule.

## Mutation

mutation: no changed core file against origin/main (69dffde4): nothing to mutate
