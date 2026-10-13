# Plan: same gate for every agent

PRD #1814, specified in [`spec.md`](spec.md) beside this plan. The feature branch
`feat/same-gate-every-agent` merges into `main` through the feature PR (Closes #1814); each slice is
a sub-PR from `feat/same-gate-every-agent--<slice>` into the feature branch (Part of #1814).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | Git hooks for everyone: `pnpm install` sets `core.hooksPath .githooks`; pre-commit runs the fallow audit of the work tree, pre-push runs `check:changed`'s typecheck and lint; both fail closed; the Claude-only fallow hook and its `PreToolUse` entry are gone | `.githooks/` `scripts/install-hooks*` `scripts/check-changed*` `package.json` `.claude/hooks/` `.claude/settings.json` | — | 1 |
| s2 | `quick`: a workflow that grades every draft and every pull request whose base is not `main`, behind the settle gate, with `pnpm check:changed --base origin/<base>`; phase-0 and docs-only pull requests skip it | `.github/workflows/quick.yml` `scripts/quick-workflow*` | — | 1 |
| s3 | The knowledge says what is true: the verification form, the CI form and `AGENTS.md` describe the two hooks and `quick`, with the `session` budget held | `.omni-loop/knowledge/playbook/verification.md` `.omni-loop/knowledge/playbook/ci.md` `AGENTS.md` | s1, s2 | 2 |

Shared ground: none. `package.json` belongs to s1 alone (the `prepare` script); s2 adds no script,
running `pnpm check:changed` as it is. `scripts/settle-head.sh` and `.github/workflows/checks.yml`
are read by s2 and changed by no slice. s3 describes what s1 and s2 built, so it waits for both.

## Per slice: done when

**s1**
- In a temporary git repository, the installer sets `core.hooksPath` to `.githooks`; outside a git
  work tree it exits 0 and prints one skip line. `package.json`'s `prepare` runs it.
- `.githooks/pre-commit` runs `fallow audit` from the root of the work tree being committed (a
  `git worktree` included): a failing stub refuses the commit and prints the findings, a passing
  stub lets it through.
- `.githooks/pre-push` runs `check:changed`'s typecheck and lint steps only, from the merge-base with
  the branch's upstream, else `origin/main`; `scripts/check-changed.test.ts` covers the step subset
  `planChecks` returns.
- With fallow or pnpm unreachable (in the work tree's and the main checkout's `node_modules/.bin`
  and on `PATH`), each hook refuses with one line naming the tool and `run pnpm install`; no hook
  reads `jq`. A fallow runtime error refuses too.
- `.claude/hooks/fallow-gate.sh`, `.claude/hooks/fallow-gate.test.ts` and the `PreToolUse` entry
  that ran it are gone; the `SessionStart` briefing hook stays, and a test asserts both.
- `pnpm test` and `pnpm lint` green.

**s2**
- `.github/workflows/quick.yml` runs on `pull_request` (opened, synchronize, reopened,
  ready_for_review) into any branch; its `settle` job runs `scripts/settle-head.sh` only for a draft
  or a base other than `main`, and never for a `docs/phase-0-` head.
- Its `quick` job needs `settle`, runs only on `stale == 'false'`, installs with
  `pnpm install --frozen-lockfile`, and runs `pnpm check:changed --base origin/<base branch>` with
  enough history fetched to find the merge-base.
- Its concurrency group is `quick-<head branch>`, cancelling in progress.
- `scripts/quick-workflow.test.ts` parses the file and asserts each point above, as
  `scripts/checks-workflow.test.ts` does for `checks.yml`; `pnpm test` and `pnpm lint` green.

**s3**
- The verification form names the pre-commit and pre-push hooks and what each runs; it no longer
  says a sub-pull request runs no CI, nor that the commit hook audits the main checkout; it keeps
  the full `pnpm test` and `pnpm lint` before a pull request is marked ready.
- The CI form has a `quick` row in its workflows table, its draft and sub-PR paragraph says `quick`
  grades them, and its Claude fallow-hook paragraph is replaced by the git hooks.
- `AGENTS.md`'s Setup says `pnpm install` installs the hooks.
- `node .omni-loop/bin/omni.mjs check` exits 0, `session` under its 9 KB ceiling, which is not
  raised.
