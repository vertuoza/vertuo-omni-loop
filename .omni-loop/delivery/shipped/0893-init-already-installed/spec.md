---
prd: 893
title: omni init skips the install PR when the repository is already installed
blocked-by: none
spec: file
---

# omni init skips the install PR when the repository is already installed

**Date:** 2026-10-01 · **PRD:** #893
**Touches:**
- `kit/bin/commands/init.mjs` (an early branch, before `switchToInstallBranch`)
- `kit/lib/init/installed.mjs` (new: reads the install from the default branch)
- `kit/lib/init/steps.mjs` (the closing steps of an installed repository)
- `kit/lib/playbook/filled.mjs` (new: "a filled form", moved out of `kit/lib/plan-repo/targets.mjs`,
  which imports it)
- `kit/bin/init.test.mjs`, `kit/lib/init/installed.test.mjs` (new), `kit/lib/playbook/filled.test.mjs` (new)

## Problem

`omni init` only ever looks at the files of the branch it runs on. Every run switches to
`chore/install-omni-loop`, pushes it and runs `gh pr create`. That is right the first time; it is
wrong every time after the install pull request has merged:

- A teammate who clones a repository someone else already installed, and runs `omni init` to get
  the plugin and the sign-in on their computer, gets moved onto `chore/install-omni-loop`.
- That branch has nothing new against the default branch, so `gh pr create` fails, and init prints
  "gh could not open the pull request" with commands to type by hand.
- The closing steps still say "Install the GitHub App" and "Merge the install pull request", for a
  repository where both happened long ago, and still say "/omni:invade" for a repository that was
  invaded.

The run reads as a failure, and invites the person to open a pull request nobody needs.

## Solution

Before any other step, init asks whether the default branch already carries the install.

1. **Installed.** `git fetch <remote> <defaultBranch>`, then `git cat-file -e
   <remote>/<defaultBranch>:.omni-loop/config.yml`. The remote and the default branch come from the
   config that file holds when it is on disk; otherwise from `origin` and the remote's HEAD branch,
   as `readRepo` already reads them. When the file is on that ref, the repository is **installed**.
2. **Invaded.** Read the config at that ref for `paths.playbook` (the kit's default layout when it is
   unset), list the `.md` files under that folder at that ref (`git ls-tree`), and read each
   (`git show`). The repository is **invaded** when at least one form's front matter says
   `state: filled`. Its **invaded date** is the latest `invaded:` date among the filled forms, or
   none when no filled form carries one.
3. **Not detected, today's flow.** With `--force`, with no remote, or when the fetch or any git read
   fails, nothing is detected and init runs exactly as it does today.

When the repository is installed, init runs **only the steps for this computer**:

- It switches no branch, writes no config, bin, form, label or status line, and commits, pushes or
  opens nothing.
- It still installs the plugin and signs in, as today.
- Its output starts with `Already installed on <defaultBranch> — no install pull request.`
- Its closing steps drop "Install the GitHub App", "Merge the install pull request", the labels and
  the required-check steps, and end with:
  - **Not invaded:** `Fill the forms in <playbook>/ … /omni:invade`.
  - **Invaded:** `Already invaded (<date>).` (or `Already invaded.` without a date), then
    `To update the loop: node .omni-loop/bin/omni.mjs update`, and
    `To refresh the forms: /omni:invade --refresh`.
- It exits 0.

## Decisions

- **Installed is read on the default branch, not the working tree.** A config on the current branch
  only means the install is under way (the install branch itself, before its pull request merges);
  today's flow is right there and stays.
- **Installed alone skips the pull request.** Being invaded only changes the closing steps: an
  installed repository that is not invaded still has nothing for init to open.
- **`--force` keeps today's meaning:** a full reinstall through the install branch and its pull
  request, installed or not.
- **No version check.** Bringing an installed repository to a newer kit is `omni update`'s job; init
  only points at it.
- **"A filled form" has one definition.** The rule `omni targets` uses moves into
  `kit/lib/playbook/filled.mjs` as `isFilled(text)` and `playbookOf(configText)`; `targets.mjs`
  imports it, and init's reader uses it over git where targets uses it over `gh api`.
- **A failed read never blocks init.** It falls back to today's flow, which already reports every
  failure as a line and never throws.

## User stories

- As a teammate cloning a repository that already runs the loop, I run `omni init` and get the
  plugin and the sign-in, without a branch switch or a pull request.
- As the person who installed the loop, I rerun `omni init` after merging the install pull request
  and am told to run `/omni:invade`, not to merge a pull request that no longer exists.
- As anyone on an invaded repository, a rerun tells me it is already invaded, and how to update or
  refresh it.

## Scope

In: the detection on the default branch, the computer-only path, its closing steps, the shared
filled-form helper.

Out: kit-version comparison, any change to `--force`, to `omni update`, to `/omni:invade`, or to
the first-install flow.

## Test seams

Following `omni kb show testing`: the command through `main(['init', …])` in `kit/bin/init.test.mjs`
on a fixture repository from `makeRepo()`, with a bare local repository as its `origin` so `git fetch`
is real, and the existing `fakeExec` for `gh` and `claude`. No test calls GitHub.

- `kit/lib/playbook/filled.test.mjs`: `isFilled` on filled, blank, pointer and invalid front
  matter; `playbookOf` with and without `paths.playbook`.
- `kit/lib/init/installed.test.mjs`: not installed (no config on the ref), installed but not
  invaded (blank forms), invaded with dates (latest wins) and without, a custom `paths.playbook`,
  no remote, a failing fetch.
- `kit/bin/init.test.mjs`: the four end-to-end cases in the acceptance criteria, asserting the
  branch HEAD is on, the `gh pr create` calls `fakeExec` saw, the plugin and sign-in steps and the
  printed lines.
- `kit/lib/plan-repo/targets` tests stay green unchanged.

## Risks

Merging publishes the kit (`omni kb show releasing`): `kit/dist/omni.mjs` and the plugin change for
everyone who installs or updates. The risk is a false "installed" that skips a needed install pull
request; it is bounded because only a config already on the remote's default branch triggers it,
and `--force` always restores today's flow. Rollback: revert the feature PR; the next release
hands out the previous behaviour.

## Acceptance criteria

1. In a repository whose `origin/<defaultBranch>` has `.omni-loop/config.yml` and only blank forms,
   `omni init` leaves HEAD on the branch it started on, calls no `gh pr create`, commits and pushes
   nothing, still runs the plugin and sign-in steps, prints `Already installed on <defaultBranch> —
   no install pull request.`, ends its steps with `/omni:invade`, and exits 0.
2. In a repository whose `origin/<defaultBranch>` has a config and a form with `state: filled` and
   `invaded: 2026-09-25`, `omni init` does the same, and prints `Already invaded (2026-09-25).`
   followed by the `omni update` and `/omni:invade --refresh` lines, with no `/omni:invade` fill
   step and no "Merge the install pull request" step.
3. With `--force` in either repository, `omni init` switches to `chore/install-omni-loop` and runs
   today's flow.
4. In a repository with no remote, or whose default branch has no config, `omni init` runs today's
   flow unchanged; every existing test in `kit/bin/init.test.mjs` stays green.
5. `omni targets` reports the same `state` on the same fixtures as before the helper moved.
