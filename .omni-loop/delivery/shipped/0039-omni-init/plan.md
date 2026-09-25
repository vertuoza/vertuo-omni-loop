# omni init — install the Omni Loop kit on a repository in one command — plan

**PRD:** #39 · **Spec:** `spec.md`, beside this plan · **Feature branch:** `feat/omni-init` → `main`
(`Closes #39`) · **Sub-PRs:** `feat/omni-init--<slice>` → the feature branch (`Part of #39`).

Any decision taken without asking is an outbox item. Acceptance criteria 1–10 are proven in-process
against fixture repositories with `gh` faked. Criteria 11 and 12 are live: they need the
omni-loop-invader App installed on `vertuoza/vertuo-workflow-domain` and they create labels on real
repositories. A person runs them after the feature PR is green. No slice runs them, and no slice
creates a label on GitHub.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | `omni init` runs without a config (outside a git repository it exits 2). It writes a minimal `.omni-loop/config.yml` that `parseConfig` accepts: slug and default branch from `gh`/git, `commands.*` from package.json, composer.json or a Makefile, or from the flags, a prompt on a TTY, otherwise `null`, plus `laws.source`. It installs the running bundle as `.omni-loop/bin/omni.mjs` (and, run from source, refuses to install a shim), honours `--force`, and writes nothing outside `.omni-loop/` | `kit/bin/omni.mjs` `kit/bin/omni.test.mjs` `kit/bin/commands/index.mjs` `kit/bin/commands/init.mjs` `kit/bin/init.test.mjs` `kit/lib/init/` `kit/test/fixtures/init/` `kit/build.mjs` | — | 1 |
| s2 | `omni init` creates exactly the missing loop labels, named from the resulting config, with a fixed colour and description. It never edits, recolours or deletes a label, creates none on a second run, and when `gh` fails it still writes the files, prints the names as a human step and exits 0 | `kit/bin/commands/init.mjs` `kit/bin/init.test.mjs` `kit/lib/init/labels` | s1 | 2 |
| s3 | `omni init` ends with the closing steps: what it wrote or kept, the plugin install lines, the App install link, the optional branch-protection link with the omni-app README's warning, every `commands.*` left `null` with its flag, and the removal note. A second run exits 0. The one-line install works: the bundle is committed at `kit/dist/omni.mjs`, kept equal to a fresh build by a test, and named by the root `package.json`'s `bin`, so `npx github:vertuoza/vertuo-omni-loop init` runs it | `kit/bin/commands/init.mjs` `kit/bin/init.test.mjs` `kit/lib/init/steps` `kit/dist/` `kit/test/dist.test.mjs` `package.json` `.gitignore` | s2 | 3 |

**Shared ground.** `kit/bin/commands/init.mjs` and `kit/bin/init.test.mjs` are declared by s1, s2 and
s3: each slice adds its step to the command and its cases to the one test file. The blockers already
put them in waves 1, 2 and 3, so no two build at once. `kit/lib/init/labels` and `kit/lib/init/steps`
sit under s1's `kit/lib/init/`. That overlap is the same serial ordering, and it is why s2 and s3
cannot share a wave even though their own modules differ.

## Per slice: done when

- **s1:**
  - `omni init` is in `COMMAND_TABLE`, and `main()` dispatches it without `loadContext`. Every other
    command still loads the context first (`kit/bin/omni.test.mjs` still green).
  - Outside a git repository, `omni init` exits 2 with one line saying so (AC 9).
  - Fixture pnpm repository with `test` and `quality:preflight` scripts: the config has
    `commands.test: pnpm test`, `commands.preflight: pnpm run quality:preflight`, the slug and
    default branch the faked `gh` reports, and `laws.source: none`. `parseConfig` accepts it, and
    `.omni-loop/bin/omni.mjs` is byte-identical to the injected bundle (AC 1).
  - A composer.json fixture gives `composer test`, and a Makefile-only fixture gives `make test`. A
    bare fixture with no TTY gives `null` for all three commands, never calls `ask`, and exits 0
    (AC 2).
  - `--test`, `--preflight` and `--preflight-full` override detection (AC 3).
  - A valid existing config and bin stay byte-identical without `--force` and are rewritten with it.
    An invalid config without `--force` exits 2 with the parser's first line and writes nothing
    (AC 4).
  - The bundle carries a build-time marker (`kit/build.mjs`). Run from source with a bin to copy and
    no injected bundle, `init` exits 2, writes nothing, and names the npx command (AC 9).
  - After `init` on a clean fixture, `git status --porcelain` lists only paths under `.omni-loop/`
    (AC 7).
  - `kit/test/no-literals.test.mjs` and `pnpm kit:build` stay green.
- **s2:**
  - With some loop labels present (one with a non-default colour), the faked `gh` records creations
    for exactly the missing names and no `label edit` or `label delete` (AC 5).
  - A second `init` records no `gh label create` and exits 0 (AC 5).
  - With an invalid config and no `--force`, no label is created.
  - When label creation fails, the files are still written, the missing names are printed as a
    human step, and the exit code is 0 (AC 6).
- **s3:**
  - The closing steps are asserted line by line. They hold the plugin install lines, the
    `https://github.com/apps/omni-loop-invader/installations/new` link, the branch-protection link
    for the repository's slug with the warning, and the removal note. Only the slug and default
    branch vary between two fixtures (AC 8).
  - A fixture with `commands.test: null` lists `commands.test (--test <cmd>)` under "Not filled".
  - The kept/wrote lines reflect a second run, which exits 0.
  - `kit/dist/omni.mjs` is committed (no longer in `.gitignore`), and `kit/test/dist.test.mjs`
    proves it equals a fresh build byte for byte, starts with `#!/usr/bin/env node`, and is
    `package.json`'s `bin.omni`, with `files` limited to it (AC 10).
  - Checked by hand and recorded in the sub-PR's Verified line: in a scratch git repository,
    `npx --yes <path to this checkout> init` writes the config and a bin byte-identical to
    `kit/dist/omni.mjs`, and prints the closing steps (AC 10).
  - `node kit/dist/omni.mjs` with no command prints a usage line that lists `init`.
