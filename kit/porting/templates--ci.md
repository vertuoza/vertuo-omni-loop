# `kit/templates/playbook/ci.md`

Source: `docs/agents/ci-triage.md` @ `vertuo-ai-domain@db67fd9da`, with the PR gate's "a skipped job
counts as a failure" from `docs/agents/verification.md`. The kit default of the ci form: slots
`workflows`, `gating`, `known-reds`, `rerun`, in the spec's order.

## Read from config instead of hard-coded

| upstream | here |
|---|---|
| "three repair attempts" | `{config:limits.attempts}` (slot `rerun`) |
| `main` ("whose merge turns `main` red") | `{config:repo.defaultBranch}` (slot `gating`) |

## Dropped (repository literals)

- **The page's own reader:** "The Ship step of `vertuo-do-work` reads this page".
- **The rule's commands:** `git diff --name-only $(git merge-base origin/main HEAD)..HEAD --
  <package dir>` and `gh run rerun <run-id> --failed`. Kept, in words: your branch changes nothing
  the red names; one re-run at most (slot `rerun`).
- **Every known signature**, which is this repository's own history: the `coverage` job,
  `libs/vertuo-ai-agent-ui`, `AgentChatPage.test.tsx`, `findByText('Devis toiture')`,
  `apps/vertuoza-rest-api`, `*.e2e.test.ts`, supertest, `ECONNRESET`, `scripts/run-coverage.mjs`,
  PR #120; `ReferencePickerDialog.test.tsx`, `useReferenceSearch`, `searchQuietMs`,
  `asyncUtilTimeout: 5000`, `pnpm exec turbo run test --force`, PR #374; `test-postgres`,
  `apps/vertuo-ai-api`, `AnalysisService`, the AISession ledger, PR #224; the `audit` job's
  registry timeout. Kept: what a known red lists, and that a fixed one is a finding again on a
  branch holding the fix (slot `known-reds`). The wall-clock lesson moved to the testing form
  (`never`).
- **`all-green` "superseded by `<sha>`":** PRD #1031, `settle`, `gh api repos/<repo>/pulls/<n>`,
  `scripts/settle-head.mjs`. Kept: a run a later push superseded is never re-run (slot `rerun`).
- **The runner variables:** `CI_RUNNER`, `CI_RUNNER_LARGE`, `Settings → Variables → Actions`,
  `gh variable list`, `ubuntu-latest`, `timeout-minutes`. Kept: every job carries a timeout; a run
  stuck queued usually names a runner nothing answers to (slot `workflows`).
- **Gate facts' names:** the Railway rows, `gh pr view <n> --json mergeable`, `origin/main`, the
  preflight's `mergeable` step, ADR 0069, `gh pr ready <n>`, `all-green`, the
  `acceptance-not-needed` label, `AI Evidence QA`, `INFRA_FAILURE`, "a red `build` skips five jobs".
  Kept: no checks means a conflict; a draft and a sub-pull request run no CI; an aggregate counts a
  skip as a failure, so fix the build first; fix a red default branch forward (slot `gating`).
- **The acceptance label trap** ("only counts on the next push") and **`AI Evidence QA`** running
  the default branch's harness: repository-specific checks.
- **The quarantine table** and its `it.skip('… (quarantined, #NNN)', …)` shape. Kept: a flaky test
  not fixed in one focused attempt is quarantined with its issue in the reason, and listed (slot
  `known-reds`).

## Changed

- "Open a fix PR against `main`; do not revert unless the site is down" reads "Fix it forward;
  revert only when the product is down".
- The page title "CI triage" is the form's "CI", whose opener keeps the upstream one.

## Added

- The spec's slot markers and headings (`What gates a merge`, `Known reds`, `When to re-run`).
