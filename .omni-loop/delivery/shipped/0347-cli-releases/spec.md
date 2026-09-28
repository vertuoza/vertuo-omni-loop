---
prd: 347
title: A versioned kit, and omni update
blocked-by: none
spec: file
---

# A versioned kit, and `omni update`

**Date:** 2026-09-28 · **PRD:** #347 · **Touches:** a new `release` workflow, `kit/build.mjs` (the
version baked into the bundle), `package.json` and `kit/plugin/.claude-plugin/plugin.json` (one
version), two new `omni` commands (`version`, `update`), one config key (`branches.update`), this
repository's briefing.

## Problem

The kit has no version. There is no git tag, no GitHub Release, no `"version"` in `package.json`, and
no `omni --version`. A merge to `main` is the release: the next `npx github:vertuoza/vertuo-omni-loop
init` takes whatever `main` holds, and the `.omni-loop/bin/omni.mjs` it copies records nothing about
where it came from. So:

- **Nobody can say which kit a repository runs,** nor whether it is behind.
- **Nothing brings a repository to the latest kit.** The only way is `init --force`, which rewrites
  `config.yml` from detection and loses every edit made to it by hand.
- **The Claude plugin never updates.** `plugin.json` says `"version": "0.1.0"` and never changes.
  Claude Code decides whether a plugin has an update by that number, so
  `claude plugin update omni@omni-loop` answers "already at the latest version", and every machine
  keeps the skills it first installed.

PRD 3 designed an `upgrade` command and a version check, and PRDs 39 and 45 left both out of scope.
None of it exists.

## Solution

**One version for everything, cut on every merge.** After every push to `main`, a `release` workflow
takes the next patch number (`v0.0.1`, `v0.0.2`, …) and stamps it everywhere: `package.json`,
`plugin.json`, and the bundle `kit/dist/omni.mjs`, rebuilt so the number is baked in. It commits them
to `main` as `chore(release): v0.0.N`, tags `v0.0.N`, and publishes a GitHub Release with the bundle
attached and notes GitHub generates from the merged PR titles.

**`omni version` says which one runs.** It prints the running bin's version, and asks GitHub whether
a newer release exists:

```text
$ omni version
omni v0.0.13
latest v0.0.15, run: omni update
```

**`omni update` brings a repository to the latest, in one pull request.** It fetches the latest
release's bundle and hands over to it, so the new version's own code does the work. In a worktree cut
from the remote default branch, that code writes the new bin, checks `config.yml` against itself
(never rewriting it), creates any knowledge form the kit added, creates missing labels, and commits,
pushes and opens a pull request. A person merges it. Then it updates the Claude plugin on this
machine.

```text
$ omni update
v0.0.9 → v0.0.15
  bin      updated
  config   kept, valid under v0.0.15
  forms    1 created (.omni-loop/knowledge/playbook/security.md)
  labels   ok
  plugin   updated to v0.0.15, run /reload-plugins
PR: https://github.com/vertuoza/vertuo-workflow-domain/pull/88
```

## Decisions

Each was asked and answered in the brainstorm, 2026-09-28.

1. **Every merge to `main` cuts a version,** whatever it touched: docs-only phase-0 and retro merges,
   and app-only merges, included. The rule is simple, at the cost of a new version that changes
   nothing for an installed repository.
2. **Patch numbers only, from `v0.0.1`.** The next version is the highest `v0.0.<n>` tag plus one.
   No major or minor bump is computed from commit titles. Tags of any other shape are ignored.
3. **One number, stamped everywhere:** `package.json` `version`, `plugin.json` `version`, the bundle,
   the git tag and the GitHub Release all say the same `0.0.N`. The marketplace entry carries no
   version of its own, so the plugin's version is the one Claude Code reads.
4. **A release commit on `main`.** The workflow pushes one commit to `main` after each merge. It is
   the one push to `main` a person does not make; the briefing says so in a line of its own. It
   works today because `main` has no branch protection. If protection is added, the workflow needs a
   bypass (the Omni-man GitHub App's token is the candidate).
5. **Updating is pulled, never pushed.** A merge changes no installed repository. A repository moves
   when someone runs `omni update` in it.
6. **An update lands as a branch and a pull request,** named by `branches.update`
   (`chore/omni-update-{version}` by default). A person merges it, like every other change the loop
   makes.
7. **`omni update` updates everything the kit puts in a repository:** the bin, the config (checked
   and migrated, never rewritten), the knowledge forms (new ones only), the labels, and the Claude
   plugin on the machine that runs it.
8. **The new version does the work.** The running bin only finds and fetches the new bundle, then
   runs it. Only the new code knows its own config format, forms and labels.
9. **`config.yml` is never rewritten by an update.** A key a later kit adds needs no line, because it
   falls back to its default. A change to the format itself (`kit: 1` becoming `kit: 2`) ships with a
   migration that keeps every value. A file that does not pass under the new version stops the
   update, naming the key, before anything is committed.
10. **Finding stale repositories is out of scope.** That belongs to a later `omni doctor`.

## User stories

1. As someone working in a repository that runs the loop, I run `omni version` and see which kit it
   runs, and whether a newer one exists.
2. As that person, I run `omni update` and get one pull request that brings the repository to the
   latest kit, with my `config.yml` untouched, and the skills on my machine updated too.
3. As the person who merges to the kit's `main`, I do nothing more: the release, its number, its
   notes and its bundle appear by themselves.
4. As someone whose repository was installed before versions existed, I run
   `npx github:vertuoza/vertuo-omni-loop update` once, and plain `omni update` from then on.
5. As someone whose repository went too far, I run `omni update --to v0.0.12` and get the pull request
   that takes it back there.

## Scope

**The release (a new workflow, `.github/workflows/release.yml`, and its script).**

- It runs on every push to `main`, one run at a time (a `release` concurrency group that never
  cancels a queued run), and skips a push whose head commit is a release commit.
- Its logic lives in a script under `kit/release/` with its own tests; the workflow only checks out
  `main` with its whole history and tags, installs, and calls it.
- The script: computes the next version, writes it into `package.json` and `plugin.json`, runs
  `pnpm kit:build`, commits the three files as `chore(release): v0.0.N` signed with the Omni
  signature (`omni sign trailer`), tags `v0.0.N`, pushes the commit and the tag, and creates the
  GitHub Release with `kit/dist/omni.mjs` attached and generated notes.
- If `main` moved while it ran, it rebases onto the new `main` once and pushes again. If that fails,
  the run fails, red on `main`, and nothing is tagged. The next merge takes the next number.
- Permissions: `contents: write`, and nothing else.

**The build.** `kit/build.mjs` reads `version` from `package.json` and records it in the bundle's
marker beside `home` (`__OMNI_BUNDLE__` becomes `{ home, version }`). `kit/test/dist.test.mjs` keeps
checking that the committed bundle is byte-identical to a fresh build. A `package.json` with no
`version` yet builds a bundle whose version is `null`.

**`omni version`** (and `omni --version`, the same command).

- Prints `omni v<version>` from the bundle's marker, or `omni v<version> (source)` from
  `package.json` when it runs from the kit's source, or `omni (unversioned)` when the bundle carries
  no version.
- Then asks GitHub, through `gh`, for the latest release of the kit's home repository, within 5
  seconds. Behind: a second line, `latest v<latest>, run: omni update`. Up to date: `(latest)` is
  added to the first line. No answer, no `gh`, no sign-in, or no release yet: the first line alone.
- Always exits 0, except on a usage error.

**`omni update [--to <version>]`.**

1. **Find the target:** the latest release of the kit's home repository, or the tag `--to` names.
   An unknown tag, no `gh` sign-in, or GitHub out of reach stops it with one line and exit 1,
   before anything is written.
2. **Up to date** (the running version is the target): skip to the plugin step.
3. **Fetch and hand over:** download the target release's `omni.mjs` into a temporary folder, and run
   it as `node <bundle> update --apply --from <running version>`. `--apply` is internal: it does
   steps 4 to 7 with the code of the version it is. From the kit's own source (this repository,
   whose bin is a shim onto the source), there is no bin to replace: only the plugin step runs.
4. **A worktree:** fetch the remote, and add a worktree under `worktrees` on a new branch named by
   `branches.update` with `{version}` filled, from the remote default branch. The person's checkout
   is never touched. An open pull request from that branch already: print its link and stop, exit 0.
5. **The files:** copy the bundle over `.omni-loop/bin/omni.mjs` (mode 755); check `config.yml` under
   this version's schema, after running any migration from the file's `kit:` to this one's, and stop
   before committing if it does not pass, naming the key; create each knowledge form the kit has
   and the repository lacks, through the same writer as `omni init`, never over an existing file.
6. **The labels:** reconcile them as `omni init` does. They are on GitHub, not in the commit.
7. **The pull request:** commit `chore(omni): update to v<version>` with the Omni signature, push,
   and open it into the default branch through `gh`, with a body that says what changed in the
   repository (the lines printed above), links GitHub's compare page between the two tags, and ends
   with the `omni sign footer` line. Print its link.
8. **The plugin:** run `claude plugin marketplace update omni-loop`, then
   `claude plugin update omni@omni-loop`, and print `run /reload-plugins`. With no `claude` command,
   or one that fails, print the two lines to type in Claude Code instead
   (`/plugin marketplace update omni-loop` and `/plugin update omni@omni-loop`). The pull request is
   already open; a plugin that did not update stops nothing.

**The first update of an unversioned repository.** Its bin has no `update` command, so it runs
`npx github:vertuoza/vertuo-omni-loop update` once: `main`'s bundle, which is the latest release. The
closing steps `omni init` prints, and the kit's README, name `omni update` as the way to update.

**Config.** A new key, `branches.update`, default `chore/omni-update-{version}`. `CONFIG_VERSION`
stays 1; the migration step exists and has no migration in it yet.

**The briefing** (`.omni-loop/knowledge/playbook/briefing.md`, Never): the release workflow's
version commit is the one push to `main` a person does not make.

**An ADR:** the kit carries one release version, stamped on every merge. Each knowledge form keeps its
own `form-version` (ADR-0020 stands).

**Out of scope:** `omni doctor` and finding stale repositories; a nudge on every command; minor and
major versions; publishing to npm; pushing updates to installed repositories; pinning the plugin
marketplace to a tag.

## Test seams

Following `omni kb show testing`: vitest, beside the code, and no test ever calls GitHub. Every call
to `gh`, `git` or `claude` goes through the injected `exec`.

- **The next version,** a pure function: no tag gives `0.0.1`; `v0.0.9` gives `0.0.10`; tags of
  another shape (`v1.2`, `release-3`, `v0.1.0`) are ignored.
- **The release script,** on a fixture repository with a fake `exec`: it writes the version into both
  manifests, commits with the trailer, tags, and creates the release with the bundle attached; a head
  commit that is a release commit makes it do nothing; a failed push is retried once after a rebase,
  then fails.
- **The build:** the bundle's marker carries the version from `package.json`; `dist.test` stays green.
- **`omni version`,** through `main()` with a fake `gh`: behind, up to date, `gh` failing, no release
  yet, running from source, a bundle with no version.
- **`omni update`,** through `main()` on a fixture repository with a fake `gh`, `git` and `claude`:
  `config.yml` is byte-identical afterwards; a missing form is created and an existing one is left
  as it was; the branch, the commit's trailer and the pull request are made; an open pull request
  from the branch is reported and nothing new is made; a config that does not pass stops before any
  commit and names the key; up to date runs only the plugin step; no `claude` prints the two
  `/plugin` lines; `--to` with an unknown tag stops before anything is written; from the kit's source,
  only the plugin step runs.
- **The command table:** `version` and `update` appear in `omni help`, and `plugin.test` knows them.

## Risks

Read with `omni kb show releasing`: a merge to `main` already hands out the kit (the bundle the
install runs, and the plugin the marketplace serves).

- **What merging publishes:** the `release` workflow, which from then on pushes a commit and a tag to
  `main` and publishes a GitHub Release after every merge. This PRD's own merge carries the workflow,
  so it publishes `v0.0.1`, and every release has `omni update`. Every machine that runs `claude plugin update` gets the current skills for the first time
  since the plugin was installed.
- **A commit on `main` after every merge.** Branches behind `main` take one more commit when they
  update, which only touches three files. A pull request that also rebuilt the bundle can conflict on
  it; the fix is the usual one, `pnpm kit:build` after the merge.
- **A push to `main` from CI.** Branch protection added later without a bypass stops every release,
  red on `main`, until the workflow gets a token allowed to push.
- **Rollback:** revert this PRD's merge. That removes the workflow, and the kit returns to having no
  version. Published tags and releases can stay: nothing depends on removing them. A repository that
  updated too far runs `omni update --to <version>`.

## Acceptance criteria

1. After a merge to `main`, `main` carries a `chore(release): v0.0.N` commit, a `v0.0.N` tag and a
   GitHub Release with `omni.mjs` attached, and `package.json`, `plugin.json` and the bundle all say
   `0.0.N`.
2. A push whose head is a release commit cuts no release.
3. `omni version` in a repository whose bin is `v0.0.N` prints `omni v0.0.N`, and adds the
   `latest …, run: omni update` line when a newer release exists; it exits 0 with GitHub out of
   reach.
4. `omni update` in a repository behind the latest opens one pull request that replaces the bin,
   leaves `config.yml` byte-identical, creates only the missing forms, and is signed; the person's
   checkout is unchanged.
5. `omni update` in a repository already on the latest opens no pull request and still updates the
   plugin.
6. `omni update` runs `claude plugin marketplace update omni-loop` and
   `claude plugin update omni@omni-loop`, or prints the two `/plugin` lines when it cannot.
7. `omni update` whose `config.yml` does not pass under the new version names the key and commits
   nothing.
8. `omni update --to v0.0.N` opens the pull request that takes the repository to `v0.0.N`.
9. `npx github:vertuoza/vertuo-omni-loop update` works in a repository installed before versions
   existed.
10. `pnpm test` is green, with the tests of the seams above.
