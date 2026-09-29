# Plan: PR checks — tests and Fallow on ready pull requests

PRD #598, spec in `spec.md` beside this plan. Built on the feature branch `feat/pr-checks` into
`main` (`Closes #598`), through sub-PRs from `feat/pr-checks--<slice>` into the feature branch
(`Part of #598`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | `fallow` is a pinned root dev dependency with a `fallow:audit` script; `.fallowrc.jsonc` lists the entry points no import names and points the audit at `fallow/dead-code.json`, `fallow/dupes.json` and `fallow/health.json`, generated from today's code, with `fallow/README.md` saying how and when to regenerate them; `pnpm fallow:audit` exits 0; `vitest.config.mjs` includes `.claude/hooks/**/*.test.mjs` and `scripts/**/*.test.mjs` | `.fallowrc.jsonc` `fallow/` `package.json` `pnpm-lock.yaml` `vitest.config.mjs` | — | 1 |
| s2 | The Claude hook `.claude/hooks/fallow-gate.sh`, run by a `PreToolUse` entry on `Bash` in `.claude/settings.json`, runs the Fallow audit before any `git commit` or `git push` in a command, blocks with the findings on verdict `fail`, and lets the command through with one stderr line when Fallow or `jq` is missing or the audit crashes | `.claude/hooks/` `.claude/settings.json` | s1 | 2 |
| s3 | The `checks` workflow grades a ready PR into `main`: `settle` waits 180 s and skips the rest when the branch moved (`scripts/settle-head.sh`), then `test` runs `pnpm test` and `fallow` runs `pnpm fallow:audit`; drafts, other bases and docs-only PRs run nothing, and a newer push cancels an older run | `.github/workflows/checks.yml` `scripts/settle-head` | s1 | 2 |
| s4 | The playbook's `ci.md` lists `checks` › `test` and `checks` › `fallow`, says a draft and a sub-PR run no CI and a ready PR into `main` does, and its "What gates a merge" section has no `TODO(human)` left | `.omni-loop/knowledge/playbook/ci.md` | s2, s3 | 3 |

**Shared ground.** No prefix is declared by two slices. `vitest.config.mjs` is the one file both
s2's and s3's tests need a line in, so s1 owns it and adds both include lines up front; s2 and s3
then share nothing and run side by side in wave 2. Both need s1's `fallow:audit` script and
pinned binary. s4 waits for both, because it documents the jobs and the hook by their final
names.

## Per slice: done when

**s1**
- `package.json` has `fallow` at an exact version (no `^`) in `devDependencies` and a
  `fallow:audit` script; `pnpm-lock.yaml` is updated and `pnpm install --frozen-lockfile` passes.
- `pnpm fallow:audit` exits 0 on the slice's head, and exits non-zero when a scratch commit adds an
  unused export (checked locally, not committed).
- Every `entry` and `ignore*` line in `.fallowrc.jsonc` carries a comment saying why; `typeAware`
  is off.
- `fallow/README.md` gives the three regenerate commands and says a baseline is regenerated only
  after findings are cleared, never to turn a red audit green.
- `vitest.config.mjs` includes the two new globs, and `pnpm test` stays green.

**s2**
- `.claude/hooks/fallow-gate.test.mjs` passes, with `FALLOW_GATE_DRY_RUN=1`: `audit` for
  `git commit -m x`, `git push`, `git -C dir push`, `git -c a=b commit`, `git --no-pager commit`,
  `pnpm test && git commit -m x`, `(cd x; git push)` and `echo git push`; `skip` for
  `git log commit.txt`, `git status`, `ls` and an empty command.
- With a stub `fallow` on `PATH`: `{"verdict":"fail"}` → exit 2 and the JSON on stderr;
  `{"verdict":"pass"}` → exit 0; no `fallow` reachable → exit 0 and one stderr line naming why.
- `.claude/settings.json` keeps its `SessionStart` hook, `statusLine` and plugin entries, and gains
  the `PreToolUse` `Bash` entry.

**s3**
- `scripts/settle-head.test.mjs` passes with `SETTLE_SECONDS=0` and a stub `gh` on `PATH`: tip
  equal to the head sha → `stale=false` in `$GITHUB_OUTPUT`; different → `stale=true`; `gh` exits 1
  → `stale=false` and one stderr line.
- `checks.yml` triggers on `pull_request` into `main` for `opened`, `synchronize`, `reopened` and
  `ready_for_review`, ignores `**/*.md` and `docs/**`, skips `settle` on a draft, runs `test` and
  `fallow` only after a `settle` that answered `stale=false`, and has
  `concurrency: checks-<head ref>` with `cancel-in-progress: true`.
- The workflow uses the same `pnpm/action-setup` and `actions/setup-node` versions as the
  repository's other workflows.

**s4**
- `ci.md`'s Workflows table has rows for `checks` › `settle`, `checks` › `test` and
  `checks` › `fallow`, each saying when it runs and what it does.
- The paragraph saying no other workflow job runs on a pull request is rewritten to what is now
  true, and "What gates a merge" holds no `TODO(human)`; it says making the checks required on
  `main` is a GitHub setting a person turns on.
- `omni kb show ci` prints the section as `[repo]`, and `pnpm test` stays green.
