# Plan: One-line install — prerequisites up front, a global omni, init does the rest

- **PRD:** #420.
- **Spec:** `spec.md`, beside this file.
- **Feature branch:** `feat/easy-install`, merged into `main` by the feature PR, which carries
  `Closes #420`.
- **Slices:** each is built on its own branch `feat/easy-install--<slice>` and merged into the
  feature branch by a sub-PR carrying `Part of #420`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The bundle is a global launcher: inside a kit repository it hands over to that repository's `.omni-loop/bin/omni.mjs`; outside one only `init`, `help` and `--version` run; the root package has no `dependencies` | `kit/bin/omni.mjs` `kit/bin/omni.test.mjs` `kit/lib/launch/` `kit/dist/omni.mjs` `package.json` `pnpm-lock.yaml` `kit/test/package.test.mjs` | — | 1 |
| s2 | The guide lists Node, git, gh and Claude Code as prerequisites with check commands, Install is five one-line steps, troubleshooting gains three entries, and the docs guard rejects a multi-line TERMINAL block on the install page | `docs/guide/` `apps/galaxy/src/docs/guide.ts` `apps/galaxy/src/docs/guide.test.ts` `apps/galaxy/src/docs/path/` `kit/README.md` | — | 1 |
| s3 | `omni init` creates the install branch, writes `ask.url` and `dossier.enabled: true` into a fresh config, commits only its own files, pushes and opens (or finds) the install PR, with printed fallbacks; N-PRODUCT-6 is reworded | `kit/bin/commands/init.mjs` `kit/bin/init.test.mjs` `kit/lib/init/config-text.mjs` `kit/lib/init/install-pr.mjs` `kit/lib/init/install-pr.test.mjs` `kit/dist/omni.mjs` `.omni-loop/knowledge/product/invariants.md` | — | 2 |
| s4 | `omni init` installs the Claude Code plugin, offers sign-in on a terminal, and closes with the GitHub App link and "merge PR #N", each step printing its fallback lines and "already" on a rerun | `kit/bin/commands/init.mjs` `kit/bin/init.test.mjs` `kit/lib/init/steps.mjs` `kit/lib/init/plugin.mjs` `kit/lib/init/plugin.test.mjs` `kit/lib/init/signin-step.mjs` `kit/lib/init/signin-step.test.mjs` `kit/dist/omni.mjs` | s3 | 3 |

**Shared ground:**

- `kit/dist/omni.mjs` is declared by s1, s3 and s4. Every change to the kit's source rebuilds the
  committed bundle, which `kit/test/dist.test.mjs` checks. The three slices therefore sit in waves
  1, 2 and 3, and each rebuilds the bundle on top of the one before.
- `kit/bin/commands/init.mjs` and `kit/bin/init.test.mjs` are shared by s3 and s4. s4 is blocked
  by s3 and comes a wave later.
- s2 touches no kit source and no bundle, so it runs beside s1 in wave 1. It describes behaviour
  the kit slices build; the feature PR ships them together.

## Per slice: done when

**s1: global launcher**

- In a fixture repository whose `.omni-loop/bin/omni.mjs` is a different file, running the bundle
  runs that file with the same arguments, and exits with its exit code.
- When that file is the running bundle itself, or there is no git checkout, the bundle runs its
  own commands.
- Outside a kit repository:
  - `init`, `help` and `--version` run;
  - `omni status` exits 2 with `omni: no Omni Loop kit here — run omni init in your repository`.
- `yaml` and `zod` sit under `devDependencies`, and a test fails when the root `package.json` has
  any `dependencies`.
- `kit/dist/omni.mjs` is rebuilt, and `pnpm test` is green.

**s2: the guide**

- `docs/guide/index.md` › What you need first lists these four, each with its purpose, its check
  command and a link to its own install documentation, and no page explains how to install them:

  | Prerequisite | Check command |
  |---|---|
  | Node 22+ | `node --version` |
  | git | `git --version` |
  | gh, signed in | `gh auth status` |
  | Claude Code, signed in | `claude --version` |

- `docs/guide/install.md` has five steps:
  1. `npm install -g github:vertuoza/vertuo-omni-loop`, then `omni --version`.
  2. `omni init`.
  3. The GitHub App.
  4. Merge the install PR.
  5. `/omni:help`.

  No page contains the `~/.local/bin` wrapper block.
- `docs/guide/troubleshooting.md` has three new entries:
  - npm `EACCES`;
  - "repository not found", with `gh auth setup-git`;
  - an old `~/.local/bin/omni`, and how to remove it.

  The `command not found: omni` entry points to step 1.
- The docs guard (`guideProblems`) fails:
  - an `install.md` with a TERMINAL block of more than one line;
  - a guide page that names `~/.local/bin/omni` outside troubleshooting.

  `guide.test.ts` covers both, and `apps/galaxy/src/docs/path/wrapper.test.ts` is gone.
- `kit/README.md`'s install lines match the guide.
- `pnpm test` is green.

**s3: init opens the install PR**

- On a fixture repository with no kit, and `exec` stubbed, `omni init` runs these in order and
  prints the PR link:
  1. `git switch -c chore/install-omni-loop`;
  2. a `git commit` of only `.omni-loop/` and `.claude/settings.json`, as
     `chore: install the Omni Loop`;
  3. `git push -u`;
  4. `gh pr create`.
- An unrelated file changed in the working tree stays out of the commit.
- A fresh config holds `ask.url` set to the Omni Loop home page and `dossier.enabled: true`. A kept
  config is byte-identical after `init`.
- Each failure prints the exact commands to type and exits 0:
  - gh missing;
  - a push refused;
  - a PR that already exists (its link is printed with "already").
- Already on `chore/install-omni-loop`, `init` stays on it.
- N-PRODUCT-6 reads as in the spec's Decisions.
- `kit/dist/omni.mjs` is rebuilt, and `pnpm test` is green.

**s4: init installs the plugin and signs in**

- With `exec` stubbed, `omni init` runs
  `claude plugin marketplace add vertuoza/vertuo-omni-loop` and then
  `claude plugin install omni@omni-loop`, with names taken from the constants `omni update` uses.
  With `claude` missing or either command failing, it prints the two `/plugin` lines and exits 0.
- On a terminal and not signed in to `ask.url`, it runs the sign-in flow (injected in the test).
  - Signed in already, it prints "already".
  - With no terminal, or a sign-in refused or timed out, it prints `omni signin` as a later step.
- The closing lines print:
  - the GitHub App install link;
  - "merge PR #N", with the number from s3;
  - `/omni:invade`;
  - today's heads-ups.
- `kit/dist/omni.mjs` is rebuilt, and `pnpm test` is green.
