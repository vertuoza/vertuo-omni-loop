# Bug 2665: a runner job running as a GitHub App acts on GitHub as the machine's own gh login

## Triage

- **Domain:** runner — the environment of a job that runs as a GitHub App (`kit/lib/runner/github-app.ts`), and the body of the pull request `/omni:bug-fix` opens
- **Risk:** critical — an app job publishes pull requests and comments in the name of whoever is signed in with `gh` on the runner machine, so an agent's work passes as a person's (never#10, L-AIACT-1); the only workaround is to sign `gh` out on the runner (Jev, 0.44)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `kit/lib/runner/github-app.test.ts`
- **Level:** unit
- **Red:** AssertionError: expected 'as ada-personal\n' not to contain 'ada-personal'

The second reproduction, `kit/bin/bug.test.ts` (a runner job's pull request says who sent it), was red
on `AssertionError: expected 'ok\n' to be 'not ok\n- the body lacks the line omni runner sender prints, …'`.

## Fix

The job's `gh` got the app's token only through a shim first on the `PATH` the job starts with, and a
`gh` reached another way (a shell profile putting the machine's `gh` first, or a full path) read the
machine's own sign-in. Each app job now starts with `GH_CONFIG_DIR` set to an empty folder of its own,
made by the runner and removed when the job ends, so such a `gh` is signed in as nobody and fails; the
shim still works through `GH_TOKEN`. The sender line was lost because step 12 writes the body whole and
puts it on with `gh pr edit --body-file`: the skill's body shapes now carry it, and `omni bug <n>`
refuses a job's body without it.

## Guard

The unit tests in `kit/lib/runner/github-app.test.ts` run a machine `gh` signed in as a person from a
job's environment and fail if it acts as that person; `omni bug <n>` refuses, in a runner job, a pull
request body without the line `omni runner sender` prints.

## Mutation

mutation: no delivery-core file changed against origin/main
