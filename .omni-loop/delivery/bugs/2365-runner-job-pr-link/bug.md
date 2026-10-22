# Bug 2365: a runner job's PR link names any PR its output mentions, not the one it opened

## Triage

- **Domain:** runners — `kit/lib/runner/` (the job's readable lines and its `prUrl`)
- **Risk:** medium — people following a runner job on the Omni page or with `omni runner follow` are sent to an unrelated pull request; the workaround is to open the PRD page or the feature PR by hand. (Jev, 0.97)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `kit/lib/runner/job-pr.test.ts`
- **Level:** unit
- **Red:** `AssertionError: expected [ …(4) ] to deeply equal [ Array(1) ]` (reads no PR from a file, a search or test output, and keeps the one the job opened)

## Fix

`stepLine` wrote a `PR:` line for every pull request link in any tool result or assistant text, and
`lastPullRequest` sent the last link anywhere in the log as the job's `prUrl`, so links read from
retros, searches and test fixtures won. Now a `PR:` line comes only from the output of a `gh pr
create` call or from the run's hand-off, and the job's PR is the first link of its hand-off, else the
last `PR:` line, of the job's repository.

## Guard

`kit/lib/runner/job-pr.test.ts` runs a job whose output reads old pull requests and fixture links
and checks its `PR:` lines and its `prUrl` name only the PR it opened or handed off on; it fails on
`main`'s code and passes on the fix.

## Mutation

mutation: no changed core file against origin/main (7fa27e28): nothing to mutate
