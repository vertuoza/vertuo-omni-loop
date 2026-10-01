# Plan: omni init skips the install PR when the repository is already installed

PRD #893, specified in `spec.md` beside this plan. Built on the feature branch
`feat/init-already-installed` into `main`, whose feature PR says `Closes #893`; each slice is a
sub-PR from `feat/init-already-installed--<slice>` into the feature branch, saying `Part of #893`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | Installed on the default branch: `omni init` fetches `<remote>/<defaultBranch>`, and when `.omni-loop/config.yml` is on it (and `--force` is not passed) runs only the steps for this computer, with no branch switch, write, commit, push or install PR, prints `Already installed on <defaultBranch> — no install pull request.` and ends with the `/omni:invade` step; no remote, a failed fetch or `--force` keep today's flow | `kit/lib/init/installed` `kit/bin/commands/init.mjs` `kit/lib/init/steps` `kit/bin/init.test.mjs` `kit/dist/omni.mjs` | — | 1 |
| s2 | Installed and invaded: "a filled form" moves into `kit/lib/playbook/filled.mjs` (`isFilled`, `playbookOf`) and `omni targets` imports it; init reads the playbook at the default branch, and when a form is filled prints `Already invaded (<latest date>).` (or `Already invaded.`) with the `omni update` and `/omni:invade --refresh` lines instead of the `/omni:invade` fill step | `kit/lib/playbook/filled` `kit/lib/plan-repo/targets.mjs` `kit/lib/init/installed` `kit/lib/init/steps` `kit/bin/commands/init.mjs` `kit/bin/init.test.mjs` `kit/dist/omni.mjs` | s1 | 2 |

**Shared ground.**
- `kit/lib/init/installed*`, `kit/lib/init/steps*`, `kit/bin/commands/init.mjs` and
  `kit/bin/init.test.mjs`: s1 builds the installed path, s2 adds the invaded reading and its closing
  lines on top; waves 1 and 2.
- `kit/dist/omni.mjs`: both slices rebuild the bundle with `pnpm kit:build`, so
  `kit/test/dist.test.mjs` stays green; waves 1 and 2.

## Per slice: done when

**s1**
- In a fixture repository whose bare `origin` has `.omni-loop/config.yml` on `main` and only blank
  forms, `omni init` leaves HEAD on the starting branch, `fakeExec` sees no `gh pr create`, nothing
  is committed or pushed, the plugin and sign-in steps still run, the output starts with
  `Already installed on main — no install pull request.`, ends with the `/omni:invade` step, has no
  "Merge the install pull request" or GitHub App step, and the exit code is 0.
- With `--force` in that repository, init switches to `chore/install-omni-loop` and runs today's flow.
- With no remote, or with no config on `origin/main`, init runs today's flow, and every existing test
  in `kit/bin/init.test.mjs` stays green.
- `kit/lib/init/installed.test.mjs` covers installed, not installed, no remote and a failing fetch.
- `pnpm test` is green, `kit/dist/omni.mjs` rebuilt included.

**s2**
- `kit/lib/playbook/filled.test.mjs` covers `isFilled` on filled, blank, pointer and invalid front
  matter, and `playbookOf` with and without `paths.playbook`; the `omni targets` tests stay green
  unchanged.
- In a fixture repository whose `origin/main` has a config and a form with `state: filled` and
  `invaded: 2026-09-25` (and another with an earlier date), `omni init` prints
  `Already invaded (2026-09-25).`, then the `omni update` and `/omni:invade --refresh` lines, and no
  `/omni:invade` fill step and no install PR step.
- A filled form without an `invaded:` date prints `Already invaded.`; a custom `paths.playbook` on
  `origin/main` is the folder read.
- `pnpm test` is green, `kit/dist/omni.mjs` rebuilt included.
