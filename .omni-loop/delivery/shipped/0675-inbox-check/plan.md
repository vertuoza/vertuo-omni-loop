# Plan: An inbox check for phase-0 PRs, instead of the full CI and previews

PRD #675, spec in `spec.md` beside this plan. It is built on `feat/inbox-check`, which merges into
`main` with `Closes #675`. Each slice is a sub-PR from `feat/inbox-check--<slice>` into the feature
branch, with `Part of #675`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The kit gives the App what it needs, unchanged for every command: the config key `ci.inboxContext` (default `inbox`); the inbox rules for one PRD's folder (`inboxViolationsFor`), beside `findInboxViolations`, which now runs it per folder; and the plan grading `omni plan check` does, as a pure function of `plan.md` and the spec that the command now calls. The bundle is rebuilt | `kit/lib/config` `kit/lib/inbox/check-inbox` `kit/lib/inbox/plan-grade` `kit/bin/commands/plan` `kit/bin/plan` `kit/dist/` | — | 1 |
| s2 | The omni-loop App posts **omni-loop · inbox** on phase-0 PRs: the webhook sends an inbox event beside the outbox one (and alone for a re-requested inbox run); the `inbox-check` Inngest function reads the base config and posts nothing unless the head branch has the `branches.phase0` shape; a pure `evaluateInbox` grades the four gates (phase-0 verdict from the compare's paths and commits, this folder's inbox rules, the plan grading, the PRD issue open with `labels.prd`) into one summary; failures after retries complete `failure`. The README gets the inbox check's table | `apps/omni-app/src/inbox-check/` `apps/omni-app/src/webhook/` `apps/omni-app/src/inngest-client` `apps/omni-app/api/inngest` `apps/omni-app/src/outbox-check/inngest-route.test` `apps/omni-app/test/fixtures/inbox-` `apps/omni-app/README.md` | s1 | 2 |
| s3 | In this repository, a phase-0 PR skips the heavy work: `checks.yml`'s `settle` does not run for a head branch of the phase-0 shape (so `test` and `fallow` skip), and both `vercel.json` files run `scripts/vercel-ignore.sh` as their `ignoreCommand`, which skips the build for a phase-0 branch read from `omni config branches.phase0`, and builds whenever it is unsure | `.github/workflows/checks.yml` `apps/galaxy/vercel.json` `apps/omni-app/vercel.json` `scripts/vercel-ignore` | — | 1 |

**Shared ground:** none. s1 alone touches `kit/` and the bundle `kit/dist/`; s2 alone touches the
App's source, and reads the kit through s1's new entry points, so it is blocked by s1 and runs in
wave 2. s3 touches only CI, the two `vercel.json` files and its own script: `apps/omni-app/vercel.json`
is in no other territory (s2 names `apps/omni-app/src/`, `api/inngest`, `test/fixtures/inbox-` and
`README.md` by prefix, none of which covers it). Existing tests that read these files:
`kit/lib/inbox/check-inbox.test.mjs` and `kit/lib/config.test.mjs` (s1 only);
`apps/omni-app/src/outbox-check/inngest-route.test.mjs` and `src/webhook/*.test.mjs` (s2 only).

## Per slice: done when

**s1**

- `parseConfig` on a config without `ci.inboxContext` gives `inbox`; a config that sets it keeps its
  value; a non-string is refused, in `kit/lib/config.test.mjs`.
- `inboxViolationsFor({ ctx, prd })` reports the same violations `findInboxViolations` reports for
  that folder, and nothing for any other folder's faults.
- The plan grading is a pure function returning the waves, the collisions and every violation;
  `omni plan check <n>` prints exactly what it printed before on the existing fixtures.
- `kit/test/dist.test.mjs` and `kit/test/no-literals.test.mjs` pass; `pnpm test` is green.

**s2**

- `evaluateInbox` on fixtures: a complete phase-0 PR gives `success` with four `ok` lines; missing
  `plan.md`, a source file, an unsigned commit, a closed or unlabelled PRD issue, or a topic with no
  inbox folder each give `failure` naming the gate; a broken folder of another PRD changes nothing.
- End to end against the stubbed GitHub: a phase-0 PR's run completes `success` or `failure` under
  the name `ci.inboxContext` from the base config; a feature PR, and a repository with no
  `.omni-loop/config.yml` on its base, get no inbox check run; a failure after retries completes
  `failure` with the reason.
- The webhook's filter sends the inbox event for every action that sends the outbox event, and a
  re-requested inbox check run sends only the inbox event.
- The Inngest route serves `inbox-check`; `apps/omni-app/README.md` describes it.
- No test calls GitHub; `pnpm test` is green.

**s3**

- `scripts/vercel-ignore.sh` exits `0` (skip) for `docs/phase-0-anything`, and `1` (build) for
  `feat/x`, `main`, an empty branch name, and a config it cannot read, in a test run on a fixture
  repository.
- Both `vercel.json` files set `ignoreCommand` to run the script from the repository root.
- `checks.yml`'s `settle` carries the head-branch condition; the first phase-0 PR opened after the
  merge shows `settle`, `test` and `fallow` skipped and no Vercel preview built, while a feature PR
  still runs them.
