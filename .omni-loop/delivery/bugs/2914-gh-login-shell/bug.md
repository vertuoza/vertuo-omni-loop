# Bug 2914: a runner job running as the Omni App opens its pull request as the machine's gh login under a login shell

## Triage

- **Domain:** runner, jobs that run as a GitHub App (PRD 2433, PRD 2573): `kit/lib/runner/runner.ts`, `kit/lib/runner/github-token.ts`
- **Risk:** critical — every job on a runner whose shell puts the machine's `gh` ahead of the job's shim opens its pull request with the person signed in to `gh` on that machine, so an agent writes in a person's name and with that person's rights (never#10); the only workaround, signing the machine's `gh` out, makes those steps fail instead. (Jev, 0.56)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `kit/lib/runner/runner-login-shell.test.ts`
- **Level:** unit, through `runRunner()`: the environment the job's session starts with, a `gh` of the machine signed in as a person put ahead of the shim the way a login shell does
- **Red:** `AssertionError: expected 'gh pr create --fill as gho_personSign…' to be 'gh pr create --fill as ghs_fakeLoginS…' // Object.is equality`

## Fix

A job ran as the app through variables (its identity, git's credential helper), which survive any shell, but its `gh` only through a shim first on `PATH`; a login shell (macOS's `path_helper`, `brew shellenv`) put the machine's `gh` back first, and it signed in with the machine's own login. Now every token the runner keeps for a job is also written as a `gh` sign-in of the job's own, `~/logs/job-<id>.gh/` (`hosts.yml` with the current token, `config.yml` in gh's own shape so gh never migrates it), and the job's `GH_CONFIG_DIR` names it: whichever `gh` runs, it signs in as the app. The sign-in follows every refresh, the session's and the runner's, goes with the token file when the job ends, and the sweep takes one a crash left. The shim stays.

## Guard

`kit/lib/runner/runner-login-shell.test.ts` runs the job's `gh` by name with the machine's `gh` first on `PATH` and its person's sign-in in the home, and checks the job's `GH_CONFIG_DIR`: both fail on main's code. `kit/lib/runner/github-cli.test.ts` pins the sign-in's shape, its refresh, its removal with the token file and the sweep of one a crash left.

## Mutation

mutation: no changed core file against origin/main (5515c1f1): nothing to mutate

## Still open

- A GH_TOKEN or GITHUB_TOKEN exported by the runner user's shell profile outranks the job's own gh sign-in under a login shell: the runner guide says to keep them out, but nothing checks it. The runner could refuse to start, or warn, when its login shell exports one.
