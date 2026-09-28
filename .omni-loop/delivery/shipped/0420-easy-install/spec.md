---
prd: 420
title: One-line install — prerequisites up front, a global omni, init does the rest
blocked-by: none
spec: file
---

# One-line install — prerequisites up front, a global omni, init does the rest

**Date:** 2026-09-28 · **PRD:** #420 · **Touches:** the Getting Started guide (`docs/guide/index.md`,
`install.md`, `troubleshooting.md`), its docs guard (`apps/galaxy/src/docs/guide.ts`), the bundle's
entry (`kit/bin/`), `omni init` (`kit/bin/commands/init.mjs`, `kit/lib/init/*`), the root
`package.json`, and the invariant N-PRODUCT-6.

## Problem

Installing the Omni Loop is still hard. The guide's Install page is twelve steps:

1. Install Node 22.
2. Install gh and sign in.
3. Install Claude Code.
4. Create a branch.
5. Run `npx github:vertuoza/vertuo-omni-loop init`.
6. Edit `.omni-loop/config.yml` by hand to add `ask.url` and `dossier.enabled`.
7. Commit, push, open the PR, merge it, pull.
8. Paste a 13-line block that writes `~/.local/bin/omni` and appends a PATH line to `~/.zshrc`.
9. Run two `/plugin` commands.
10. Install the GitHub App.
11. Run `omni signin`.
12. Run the checks.

Three things make it painful:

- **Tools we don't own are walked through in the main path.** Node, gh and Claude Code each get a
  step, so their install problems become ours to support.
- **The PATH step is the worst block in the guide.** It is thirteen lines and works only with zsh.
  Bash users have to edit it by hand, and pasting it twice adds the PATH line twice.
- **Most of the rest is chores a command could do.** Writing two config keys, six git/gh commands to
  get the install PR open, two plugin commands, and sign-in.

## Solution

### Prerequisites, not steps

The page `index.md` › **What you need first** lists these prerequisites:

| Prerequisite | Check command |
|---|---|
| Node 22 or later | `node --version` |
| git | `git --version` |
| gh, signed in | `gh auth status` |
| Claude Code, signed in | `claude --version` |

The page also keeps the repository you administer and the Omni Loop invite.

Each prerequisite gets:

- one line saying what it is for;
- its check command;
- a link to its own install documentation.

The guide no longer explains how to install them.

### A global `omni`

- A person installs `omni` once per laptop with `npm install -g github:vertuoza/vertuo-omni-loop`.
- npm's global bin folder is already on the PATH for anyone who installed Node, so no shell file is
  edited.
- The installed command is the kit's existing bundle, `kit/dist/omni.mjs`, which is the root
  package's `bin.omni` today.

**The bundle becomes a launcher.** Before anything else, it looks at where it is running:

- **Inside a git checkout** whose `.omni-loop/bin/omni.mjs` exists and is a different file from the
  running one, it runs that file with Node. It passes every argument, stdin, stdout and stderr
  through, and exits with its exit code. The repository's pinned copy always runs, so the drift
  concern of PRD 373 does not arise.
- **Otherwise** it runs itself.
  - Outside a repository that has the kit, `init`, `help` and `--version` work as today.
  - Any other command exits 2 with one line: `omni: no Omni Loop kit here — run omni init in your
    repository`.

To install the kit's newest version on the laptop, a person reruns the same npm line. That only
matters for `init`, because every other command runs the repository's copy, which `omni update`
keeps current.

`yaml` and `zod` move from `dependencies` to `devDependencies`. The bundle has no dependencies, so
a global install downloads nothing but the bundle.

### `omni init` does the rest

After what it does today, `init` takes the remaining chores.

**It writes the ask and dossier keys.** A fresh config carries `ask.url` set to the Omni Loop home
page (the same address as `signature.home`'s default, ADR-0047) and `dossier.enabled: true`. The
config schema's own defaults do not change, so an existing config reads exactly as before.

**Its steps run in this order.** Each step prints one status line. A step that cannot be done prints
the exact lines to type instead, and `init` carries on; a skipped step never makes `init` fail.

1. **Branch.** It switches to a new branch `chore/install-omni-loop` from the current `HEAD`.
   - If it is already on that branch, it stays there.
   - If the working tree has changes to files `init` does not write, it still goes ahead, and step 3
     commits only its own files.
2. **Files, as today.** It writes the config, the bin, the knowledge forms, the status line and the
   labels.
3. **Install PR.**
   - It commits the files it wrote (`.omni-loop/` and `.claude/settings.json`) as
     `chore: install the Omni Loop`.
   - It pushes the branch.
   - It opens the pull request with `gh pr create`, then prints its link.
   - If a pull request already exists for the branch, it prints that pull request's link instead.
4. **Plugin.** It runs `claude plugin marketplace add vertuoza/vertuo-omni-loop` and then
   `claude plugin install omni@omni-loop`, reading their names from the constants
   `omni update` uses. If `claude` is missing or either command fails, it prints the two
   `/plugin` lines to type in Claude Code instead.
5. **Sign-in.**
   - If this computer is not signed in to `ask.url` and a terminal is attached, it runs the
     `omni signin` flow, which opens the browser.
   - If there is no terminal, the sign-in fails, or it times out, it prints `omni signin` as a
     later step.
6. **Closing lines.** It prints:
   - the GitHub App's install link;
   - "merge PR #N";
   - `/omni:invade` as the next step;
   - the heads-ups it gives today (older loop, formatter).

A rerun of `init` on a repository that already has the kit keeps its config as today, and redoes
only the steps that are not done yet: a pull request that already exists, a plugin already
installed or a sign-in already held each print "already" and move on.

### The guide after

`install.md` has five steps. Every block the guide marks TERMINAL on this page is one line.

1. Run `npm install -g github:vertuoza/vertuo-omni-loop`, then check it with `omni --version`.
2. In your repository, run `omni init`.
3. Install the GitHub App from the link `init` printed.
4. Merge the install pull request `init` opened.
5. In Claude Code, run `/omni:help`, then go on to *Invade*.

`troubleshooting.md` gains three entries:

- **npm `EACCES` on a global install:** npm's own documentation on its global folder.
- **"repository not found" while installing:** the kit repository is private during the beta.
  Check the GitHub account has read access, and run `gh auth setup-git` so git uses gh's sign-in.
- **An old `~/.local/bin/omni` from PRD 373:** it is harmless, because both run the repository's
  copy. The entry says how to delete it and the PATH line it added.

The `command not found: omni` entry now points to step 1.

## Decisions

- **A global launcher rather than a wrapper script or an init-written PATH.** npm already puts its
  global bin on the PATH. Delegating to the repository's copy keeps PRD 373's reason (one pinned
  version per repository) without the shell-specific block. It was chosen over having `omni init`
  write `~/.local/bin` and a shell rc, and over dropping `omni` from the PATH altogether.
- **The launcher is the same bundle, not a second file.** There is one build, one release asset and
  one bin.
- **git and gh, signed in, join Node and Claude Code as prerequisites.** `init` needs gh to open the
  install pull request.
- **Every step `init` adds degrades to printed lines.** A missing `claude`, a failed push or no
  terminal never leaves the person with less than the guide gives today.
- **The install branch name is fixed** (`chore/install-omni-loop`, the name the guide uses today),
  not a config key: `init` runs before any config exists.
- **Scope of N-PRODUCT-6.** "omni init never writes a file outside `.omni-loop/`" becomes "omni init
  writes no file in the repository outside `.omni-loop/` and the `statusLine` key of
  `.claude/settings.json`; it also creates a branch, commits, pushes and opens a pull request with
  what it wrote, and installs the Claude Code plugin on the computer it runs on." That is what the
  code already did for `.claude/settings.json`, plus the new git and plugin steps.
- **The `ask.url` default is written by `init`, not added to the schema.** Repositories installed
  earlier keep reading as they do.

## User stories

- As a newcomer who has Node, git, gh and Claude Code, I type one npm line and `omni init`, click
  the GitHub App link, merge one pull request, and `/omni:help` works in my repository.
- As a newcomer on bash or fish, nothing in the install asks me to edit a shell file.
- As a person with several repositories on different kit versions, `omni` in each one runs that
  repository's own copy.
- As a newcomer without `claude` on my PATH, or who skipped sign-in, `init` still finishes and tells
  me the exact lines left to type.
- As the Omni Loop team, we no longer support installing Node, gh or Claude Code in our guide.

## Scope

In:

- the launcher behaviour of the bundle and its test;
- `omni init`'s branch, config keys, commit/push/PR, plugin and sign-in steps, their fallbacks and
  their tests;
- the root `package.json` dependency move;
- `docs/guide/index.md`, `install.md` and `troubleshooting.md`;
- the docs guard rule for one-line TERMINAL blocks on the install page, and removing
  `apps/galaxy/src/docs/path/wrapper.test.ts`;
- N-PRODUCT-6's new wording.

Out:

- publishing to the npm registry;
- Windows-specific instructions;
- `init` opening the GitHub App page in the browser (it prints the link);
- `init` merging the install pull request;
- removing an old `~/.local/bin/omni` automatically;
- any change to `omni update`.

## Test seams

Tests follow `omni kb show testing`: they sit beside the code as `*.test.mjs`, and none calls GitHub,
the Omni page or a real `claude`.

- **Launcher** (`kit/bin/…launcher.test.mjs`), a pure decision function plus a command test on a
  `makeRepo()` fixture:
  - it hands over to the repository's bin when that bin exists and is a different file;
  - it runs itself when that bin is the running file;
  - it runs itself outside a git checkout;
  - outside a kit repository, `init`, `help` and `--version` run, and any other command exits 2 with
    the one line;
  - the handed-over exit code and arguments pass through unchanged.
- **`omni init`**, through `main()` on a fixture repository with `exec` stubbed for git, gh and
  claude, and the sign-in flow injected:
  - the happy path prints each status line, and runs `git switch -c chore/install-omni-loop`,
    `git commit` on only its own paths, `git push -u`, `gh pr create` and the two `claude plugin`
    calls;
  - each failure prints its fallback lines and exit 0: no gh, a push refused, a PR that already
    exists, `claude` missing, a plugin command failing, no terminal, and a sign-in refused;
  - a fresh config holds `ask.url` (the home page) and `dossier.enabled: true`; a kept config is
    untouched;
  - a rerun on an installed repository prints "already" for each step that is done.
- **Docs guard** (`guideProblems`): it fails an `install.md` with a TERMINAL block of more than one
  line, and fails any guide page that still contains `~/.local/bin/omni` outside the
  troubleshooting entry.
- **Package:** a test reads the root `package.json` and fails when `dependencies` is not empty.

## Risks

Merging this publishes the kit (`omni kb show releasing`):

- the root `bin`, which the npm line installs;
- the plugin marketplace;
- a new release `v0.0.N` with the new bundle;
- the guide, the next time the galaxy app deploys.

Known risks:

- **npm installing from a private GitHub repository** depends on the person's git credentials. The
  troubleshooting entry covers it, and the manual acceptance run proves it on a blank laptop.
- **A launcher bug would break every `omni` on the laptop, not one repository.** The hand-over is
  small and tested. Running `node .omni-loop/bin/omni.mjs` directly, as every skill already does,
  keeps working whatever the launcher does.
- **`init` pushing and opening a pull request** is new outward action. It only pushes the branch it
  created, and never touches the default branch.

Rollback: revert the feature PR's merge commit. The next release ships the previous bundle, and
people who installed globally rerun the npm line. Repositories installed in between keep a working
install: their config only has two more keys, and their install PR is an ordinary PR.

## Acceptance criteria

- `docs/guide/index.md` lists Node 22+, git, gh signed in and Claude Code signed in as
  prerequisites, each with its check command and a link, and no guide page explains how to install
  any of them.
- `docs/guide/install.md` has five steps, and every TERMINAL block on it is one line. The docs guard
  fails when one is not.
- After `npm install -g github:vertuoza/vertuo-omni-loop`, `omni --version` works in a new terminal
  in any directory, with no shell file edited.
- Inside a repository with the kit, `omni` runs that repository's `.omni-loop/bin/omni.mjs`, even
  when the global copy is a different version.
- Outside a repository with the kit, `omni status` exits 2 with
  `omni: no Omni Loop kit here — run omni init in your repository`.
- On a repository with no kit, `omni init`:
  - creates `chore/install-omni-loop`;
  - writes a config with `ask.url` set and `dossier.enabled: true`;
  - commits only its own files, pushes, and opens a pull request whose link it prints;
  - installs the plugin;
  - offers sign-in;
  - ends with the GitHub App link and "merge PR #N".
- With `claude` missing, gh unable to push, or no terminal, `omni init` exits 0 and prints the exact
  lines to type for each skipped step.
- The root `package.json` has no `dependencies`.
- N-PRODUCT-6 reads as in Decisions.
- A colleague whose laptop has only the prerequisites reaches `/omni:help` in a repository of theirs
  by following the guide, typing only one-line commands (manual, recorded on the feature PR).
