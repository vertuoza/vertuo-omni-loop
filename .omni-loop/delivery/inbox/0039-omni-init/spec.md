---
prd: 39
title: omni init — install the Omni Loop kit on a repository in one command
blocked-by: none
spec: file
---

# omni init — install the Omni Loop kit on a repository in one command

**Date:** 2026-09-25 · **PRD:** #39 · **Follows:** #3 (the kit), #7 (the `omni` plugin), #28 (the
omni-loop GitHub App) · **Replaces:** the `init` sketched in PRD 3's spec §10 (never built)

## Problem

Today a repository adopts Omni Loop by hand. Someone writes `.omni-loop/config.yml`, copies the
bundled bin to `.omni-loop/bin/omni.mjs`, and creates the labels the loop uses (`prd`, the `pr:*`
labels and `outbox:go`). Then they find out elsewhere that the repository also needs the omni plugin
and the omni-loop GitHub App. Every step is easy to get wrong or forget. This repository still has
none of its loop labels, and a config without the bin fails every skill at its first step
(`node .omni-loop/bin/omni.mjs config`).

Rolling the loop out to other Vertuoza repositories, many of them not TypeScript (PHP and others),
needs this to be one command that gets it right the first time.

## Solution

A new subcommand, `omni init`, registered in `COMMAND_TABLE` and run from the root of the target
repository with the bundle from an Omni Loop checkout:

```bash
cd <target repository>
node <vertuo-omni-loop checkout>/.omni-loop/bin/omni.mjs init [--force] [--test <cmd>] [--preflight <cmd>] [--preflight-full <cmd>]
```

It does four things, in this order:

1. **Writes `.omni-loop/config.yml`.** Values it reads:
   - `repo.slug` from `gh repo view --json nameWithOwner`, falling back to the `origin` remote URL.
   - `repo.defaultBranch` from `gh repo view --json defaultBranchRef`, falling back to
     `git symbolic-ref refs/remotes/origin/HEAD`.
   - `commands.*` from the command detection table below.
   - `laws.source`.

   The file is minimal and commented, in the style of this repository's own config. It holds only
   `kit`, `repo`, `labels.autoCreate: false`, `commands` and `laws`, and every other key keeps its
   schema default. It is written only after the kit's own `parseConfig` accepts it (the parser that
   `omni config` and the omni-app's `evaluate` use), so an invalid config is never written.
2. **Installs the bin.** It copies the bundle it is running from to `.omni-loop/bin/omni.mjs`. The
   bundle is one plain-Node file with no dependencies, so the target repository needs no JS
   toolchain, only Node 22+ and `gh` on the machine that runs the loop.
3. **Creates the missing labels.** The names come from the resulting config's `labels.*`. It lists
   the repository's labels once and creates only the missing ones, each with a fixed colour and a
   description. It never edits, recolours or deletes an existing label.
4. **Prints the remaining human steps**, with links: install the omni plugin, install the omni-loop
   GitHub App on this repository, and optionally require the `outbox` check in branch protection
   under the omni-app README's warning. It also lists any `commands.*` it could not fill, and how to
   remove the loop again.

### Command detection

The first source that exists wins. Flags always override what is detected.

| Source | `commands.test` | `commands.preflight` | `commands.preflightFull` |
|---|---|---|---|
| `package.json` scripts, run through the package manager its lockfile names (`pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `bun.lockb`/`bun.lock` → bun, otherwise npm) | `<pm> test` when a `test` script exists | `<pm> run preflight` or `<pm> run quality:preflight` when one exists, otherwise the test command | `<pm> run preflight:full` when it exists, otherwise the preflight command |
| `composer.json` `scripts` | `composer test` when a `test` script exists | `composer preflight` when it exists, otherwise the test command | the preflight command |
| `Makefile` targets | `make test` when a `test:` target exists | `make preflight` when it exists, otherwise the test command | the preflight command |
| none of the above | — | — | — |

When a command is still unknown after detection and flags:
- On an interactive terminal (stdin and stdout are both TTYs), `init` asks for it once, and an empty
  answer means none.
- Otherwise (an agent, CI) it writes `null`. The closing steps name the key and the flag that would
  fill it. `init` never fails because a command is unknown.

### `laws.source`

`knowledge` when the default knowledge folder (`.omni-loop/knowledge`) exists, otherwise
`claudeMdInvariants` when `CLAUDE.md` has a `## Invariants` heading, otherwise `none`.

### Idempotence and `--force`

| State before | Without `--force` | With `--force` |
|---|---|---|
| No `.omni-loop/config.yml` | writes it | writes it |
| A config that parses | keeps it and says so; its label names are the ones used | overwrites it |
| A config that does not parse | exits 2 with the parser's first line, writes nothing, creates no label | overwrites it |
| No `.omni-loop/bin/omni.mjs` | copies it | copies it |
| A bin already there | keeps it and says so | overwrites it |

Labels are always reconciled: missing ones are created and existing ones are left alone. Running
`init` twice on a repository therefore changes nothing the second time and exits 0.

### Footprint

`init` writes only under `.omni-loop/`: `config.yml` and `bin/omni.mjs`. It adds no `.github/` file,
no workflow, no secret, and changes no `.gitignore`, `package.json`, `composer.json` or `CLAUDE.md`.
Removing the loop from the repository is `rm -rf .omni-loop` plus a commit. What that leaves behind is
stated in the closing steps: the labels `init` created, and the App installation.

### The closing steps (shape)

```text
omni init — vertuoza/<repo> is set up.
  wrote   .omni-loop/config.yml          (or: kept — pass --force to overwrite)
  wrote   .omni-loop/bin/omni.mjs        (or: kept)
  labels  created prd, pr:phase-0, …     (already there: …)

Commit .omni-loop/ and merge it into <defaultBranch>, then, by hand:
  1. Install the omni plugin in Claude Code:
       /plugin marketplace add vertuoza/vertuo-omni-loop
       /plugin install omni@omni-loop
  2. Install the omni-loop GitHub App on vertuoza/<repo>:
       https://github.com/apps/omni-loop-invader/installations/new
  3. (Optional) Require the `outbox` check on <defaultBranch>:
       https://github.com/vertuoza/<repo>/settings/branches
     Warning: a required check that is never posted blocks every pull request in this repository.
     If the app is uninstalled, its deploy is broken or Inngest is down, nothing can merge. The remedy
     is to remove the requirement, never to fake a status.

Not filled — set them in .omni-loop/config.yml or rerun with the flag:
  commands.test (--test <cmd>)

To remove the loop: delete .omni-loop/ and commit. The labels and the App installation stay.
```

The app's slug (`omni-loop-invader`) and the marketplace names are constants in `init`, named once.

## Decisions

1. **`init` installs the bin, not only the config.** Without `.omni-loop/bin/omni.mjs`, every skill
   stops at its first step. `init` copies the bundle it runs from. Upgrading an existing bin is out
   of scope (`--force` overwrites it, nothing more).
2. **`init` runs without a context.** `main()` loads the context (and so requires a config) before
   any command. `init` is the one command that runs before a config exists, so it is dispatched
   without `loadContext`: it finds the root with `git rev-parse --show-toplevel` itself, and refuses
   outside a git repository (exit 2).
3. **`init` creates labels regardless of `labels.autoCreate`.** Running `init` is the explicit human
   consent. `labels.autoCreate` keeps its existing meaning: whether the skills may create a missing
   label while they run. `init` writes it as `false`, the schema default, and an existing config's
   value is never changed.
4. **Labels are reconciled by name only.** A label that exists with another colour or description is
   left alone. If `gh` cannot list or create labels (not logged in, no permission), `init` still
   writes the files. It prints the label names as a human step and exits 0: the files are the
   install, the labels are a convenience.
5. **Command detection is language-agnostic and small**: package.json, composer.json, Makefile, in
   that order, then flags, then a prompt on a TTY, then `null`. No other ecosystem is detected in
   this PRD.
6. **Minimal config.** Only keys that differ from the defaults, or that a reader needs to see
   (`kit`, `repo`, `labels.autoCreate`, `commands`, `laws`), are written. The schema stays the one
   definition of every other value.
7. **Nothing outside `.omni-loop/`.** Removing the loop from a repository is deleting one folder.

## User stories

- As an engineer adopting Omni Loop in a PHP repository, I run one command and get a valid config,
  the bin and the labels, without installing anything JavaScript in my repository.
- As an agent running `init` without a terminal, I get a config with `null` for what I could not
  detect and a clear list of what to fill, never a hang on a prompt.
- As an engineer who runs `init` a second time, nothing I already have is overwritten or recoloured.
- As a repository owner, I learn from the output exactly which human steps remain (plugin, App,
  optional branch protection) and how to remove the loop again.

## Scope

In:
- `kit/bin/commands/init.mjs`, registered in `COMMAND_TABLE`, and the dispatch change in
  `kit/bin/omni.mjs` that lets it run without a config.
- Command detection (package.json, composer.json, Makefile), `laws.source` detection, the minimal
  config writer (validated by `parseConfig`), the bin copy, `--force`, `--test`, `--preflight`,
  `--preflight-full`.
- Label reconciliation through `gh`.
- The closing steps, with links.
- The rebuilt bundle at `.omni-loop/bin/omni.mjs` in this repository, so the command exists here.

Out:
- Installing the GitHub App or the plugin from code, editing branch protection, creating a
  Vercel/Inngest setup.
- Migrating or upgrading repositories that already have a config (an existing one is kept or, with
  `--force`, replaced).
- `doctor`, `upgrade`, `remove` (PRD 3 §10), and detecting ecosystems beyond the three above.

## Test seams

- **`init` against fixture repositories** (a temporary git repository per test, `exec` injected, no
  network), with the existing `kit/test/fixture.mjs` style: a pnpm TypeScript repo, a PHP repo with
  `composer.json`, a Makefile-only repo, a bare repo with nothing, a repo that already has a valid
  config, and one with an invalid config.
- **The config it writes** is read back through `parseConfig` in every fixture test. That is the
  "passes the kit's own schema" assertion.
- **`gh` is a fake `exec`:** label listing returns a fixed set, creations are recorded, and a test
  asserts that no `gh label edit`/`delete` is ever issued and that an existing label is never
  recreated. A second run issues zero creations.
- **Prompts** go through an injected `ask`: a TTY fixture answers, a non-TTY fixture must never call
  it.
- **Footprint:** after `init` on a clean fixture, `git status --porcelain` lists only paths under
  `.omni-loop/`.
- The existing `kit/test/no-literals.test.mjs` and the bundle build keep passing. The closing-step
  output is asserted line by line.

## Risks

- **The App slug is baked into the bundle.** If the app is re-registered under another slug, the
  printed link is wrong until the bundle is rebuilt. That is accepted: it is one constant, and the
  step is printed, not executed.
- **A detected command can be wrong** (for example, a `test` script that needs services). It is
  printed in the output and the file is committed by a person, who can correct it before merging.
- **Branch protection:** requiring `outbox` blocks every PR when the app is down. `init` only prints
  the step with the README's warning and never edits protection.
- **This PRD is the live test of the omni-loop App (PRD 28).** If the App misbehaves, the feature PR's
  check does too. Its sub-PRs are expected to show outbox *skipped* (not a feature PR), and its
  feature PR to go red on an open outbox item and green once settled.

## Acceptance criteria

1. In a fixture pnpm repository with `test` and `quality:preflight` scripts, `omni init` writes a
   config with `commands.test: pnpm test`, `commands.preflight: pnpm run quality:preflight`, the
   slug and default branch that `gh`/git report, and `laws.source: none`. `parseConfig` accepts it,
   and `.omni-loop/bin/omni.mjs` is byte-identical to the running bundle.
2. In a fixture PHP repository with `composer.json` scripts `test`, `init` writes
   `commands.test: composer test`. In a Makefile-only repository it writes `make test`. In a
   repository with none of these and no terminal, it writes `null` for all three commands, never
   prompts, exits 0, and the closing steps name `--test`, `--preflight` and `--preflight-full`.
3. `--test`, `--preflight` and `--preflight-full` override whatever is detected.
4. With a valid config already present, `init` without `--force` leaves the config and the bin
   byte-identical and says it kept them. With `--force` it rewrites both. With an invalid config and
   no `--force`, it exits 2 with the parser's first line and writes nothing.
5. Given a repository with some loop labels already present (one with a non-default colour),
   `init` creates exactly the missing ones and issues no edit or delete. A second `init` issues no
   `gh label create` at all and exits 0.
6. When `gh` cannot create labels, the files are still written, the missing label names are printed
   as a human step, and `init` exits 0.
7. After `init` on a clean fixture, `git status --porcelain` lists only paths under `.omni-loop/`.
8. The closing steps print the plugin install lines, the App install link, and the branch-protection
   link with the warning, plus the removal note. Only the slug and default branch vary with the
   repository.
9. Outside a git repository, `omni init` exits 2 with one line saying so.
10. **Live, on `vertuoza/vertuo-workflow-domain`** (the omni-loop-invader App installed on it by
    hand):
    - Before `omni init`, a throwaway PR there shows the outbox check *skipped — omni-loop is not
      active on this repo*.
    - After `omni init` is committed and merged into its default branch, a new PR shows the check
      evaluated: *skipped — omni-loop is not active on this PR* for a non-feature PR. That proves the
      base config was read.
    - Removing the loop afterwards is deleting `.omni-loop/` in one commit.
11. **Live, on `vertuoza/vertuo-omni-loop` itself:** `omni init` keeps the existing config and bin
    and creates the missing loop labels (`prd`, `pr:*`, `outbox:go`). A second run creates none.
