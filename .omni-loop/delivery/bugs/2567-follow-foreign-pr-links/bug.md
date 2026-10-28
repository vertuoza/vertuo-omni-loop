# Bug 2567: omni runner follow prints PR links from the job's test output

## Triage

- **Domain:** kit runner: `omni runner follow` (`kit/lib/runner/follow.ts`)
- **Risk:** low — a person following a runner job sees pull request links that are not the job's; the job's saved link and the Runners page stay right (Jev, 0.58)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `kit/lib/runner/follow.test.ts`
- **Level:** unit
- **Red:** `AssertionError: expected [ …(4) ] to deeply equal [ 'PR: https://github.com/a/b/pull/7' ]` — it also printed `a/b/pull/42` from an indented step output, `acme/widgets/pull/42` and `a/bb/pull/3`

## Fix

The follow trimmed every log line before looking for `PR: <link>`, so an indented line of a failing step's output counted, and it took a link of any repository. It now counts only a `PR:` line the runner writes itself (not indented, the link alone on it) that names the job's own repository, the rule `lastPullRequest()` already uses for the job's saved link. `omni runner follow` passes the checkout's repository to `milestones()`.

## Guard

The reproduction: a unit test of `milestones()` with an indented step output, another repository and a repository whose name only starts the same; it fails on `main`'s code and passes here.

## Mutation

`mutation: no changed core file against origin/main (f3dab9de): nothing to mutate` (`kit/lib/runner/` is outside the mutation core)
