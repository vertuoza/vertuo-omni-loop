# Plan: a versioned kit, and `omni update`

PRD #347, spec beside this plan (`spec.md`). The feature branch `feat/cli-releases` merges into
`main` through the feature PR, whose body says `Closes #347`. Each slice is a sub-PR from
`feat/cli-releases--<slice>` into the feature branch, whose body says `Part of #347`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | `omni version` says which kit runs, and whether a newer one exists. Covers: `kit/build.mjs` reading `version` from `package.json` into the bundle's marker (`{ home, version }`, `null` without one); the running version read from the marker, from `package.json` with `(source)` from the kit's source, `(unversioned)` for a bundle without one; the latest release of the kit's home asked through `gh` within 5 seconds; `(latest)`, the `latest …, run: omni update` line, the first line alone when GitHub does not answer; always exit 0; `omni --version` the same command; its help entry; the rebuilt bundle | `kit/lib/version/` `kit/bin/commands/version.mjs` `kit/bin/version.test.mjs` `kit/bin/commands/index.mjs` `kit/bin/omni.mjs` `kit/bin/omni.test.mjs` `kit/build.mjs` `kit/lib/init/bundle.mjs` `kit/lib/help/` `kit/dist/omni.mjs` | — | 1 |
| s2 | Every merge to `main` cuts the next release. Covers: the next version from the tags (`0.0.1` with none, other shapes ignored); the release script under `kit/release/` writing it into `package.json` and `plugin.json`, running the build, committing `chore(release): v0.0.N` with the signature's trailer, tagging, pushing, one rebase-and-retry, and creating the GitHub Release with the bundle attached and generated notes; doing nothing when the head commit is a release commit; the `release` workflow calling it, one run at a time, `contents: write` only; the briefing's Never line; the ADR | `kit/release/` `.github/workflows/release.yml` `.omni-loop/knowledge/playbook/briefing.md` `.omni-loop/knowledge/adr/` | — | 1 |
| s3 | `omni update` opens the pull request that brings a repository to a release. Covers: the target (the latest release, or `--to <version>`), stopping before any write when it is unknown or GitHub is out of reach; up to date doing nothing to the repository; the target's bundle downloaded and run as `update --apply --from <version>`; from the kit's source, no bin step; the worktree on `branches.update` (the new key, default `chore/omni-update-{version}`) from the remote default branch; an open PR from that branch reported and nothing made; the bin copied (mode 755); `config.yml` checked after the migration step (empty today), never rewritten, stopping before the commit naming the key; missing forms created through init's writer; labels reconciled; the signed commit, the push, the PR with its body and the footer line; its help entry; the rebuilt bundle | `kit/lib/update/` `kit/bin/commands/update.mjs` `kit/bin/update.test.mjs` `kit/bin/commands/index.mjs` `kit/lib/config.mjs` `kit/lib/config.test.mjs` `kit/lib/help/` `kit/dist/omni.mjs` | s1 | 2 |
| s4 | `omni update` updates the Claude plugin, and the kit says how to update. Covers: `claude plugin marketplace update` then `claude plugin update` for the kit's marketplace and plugin, `run /reload-plugins`; the two `/plugin` lines when `claude` is missing or fails, the PR already open; the plugin step also when up to date and from the kit's source; `omni init`'s closing steps and the kit README naming `omni update`, and `npx … update` for a repository installed before versions; the rebuilt bundle | `kit/lib/update/` `kit/bin/commands/update.mjs` `kit/bin/update.test.mjs` `kit/lib/init/steps.mjs` `kit/bin/init.test.mjs` `kit/README.md` `kit/dist/omni.mjs` | s3 | 3 |

**Shared ground.** Four prefixes are declared by more than one slice, and the waves keep each group
apart:

- `kit/dist/omni.mjs`: s1, s3 and s4, in waves 1, 2 and 3. Every slice that changes `kit/bin` or
  `kit/lib` rebuilds it with `node kit/build.mjs` from its own merged source, never by hand, because
  `kit/test/dist.test.mjs` fails when it differs from a fresh build. s2 changes no bundled source, so
  it rebuilds nothing.
- `kit/bin/commands/index.mjs`: s1 and s3, each adding one command to the table, in waves 1 and 2.
- `kit/lib/help/`: s1 and s3, each adding its command's entry, in waves 1 and 2.
- `kit/lib/update/`, `kit/bin/commands/update.mjs` and `kit/bin/update.test.mjs`: s3 and s4, in
  waves 2 and 3. s4 adds the plugin step to the command s3 builds.

Wave 1 runs s1 and s2 together: s1 owns the build, the CLI's version and its command; s2 owns the
release script, its workflow, the briefing and the ADR. The release script runs `pnpm kit:build` but
its tests fake it, so s2 needs nothing of s1 to be built; that the bundle carries the stamped number
is proved once both have merged (acceptance criterion 1).

The ordering has reasons behind it:

- s3 follows s1: it reads the running version through s1's module, and compares it with the target.
- s4 follows s3: the plugin step ends the command s3 builds.

## Per slice: done when

**s1**

- `node kit/build.mjs` with `"version": "0.0.7"` in `package.json` gives a bundle whose
  `omni version` prints `omni v0.0.7`; with no `version`, `omni (unversioned)`.
- Through `main()` with a fake `gh`: behind prints `omni v0.0.13` then
  `latest v0.0.15, run: omni update`; up to date prints `omni v0.0.15 (latest)`; `gh` failing, timing
  out or finding no release prints the first line alone; every case exits 0.
- From the kit's source it prints `omni v<package.json version> (source)`.
- `omni --version` prints what `omni version` prints; `omni help` lists `version`.
- `pnpm test` is green, `dist.test` included.

**s2**

- The next version: no tag gives `0.0.1`, `v0.0.9` gives `0.0.10`, and `v1.2`, `release-3` and
  `v0.1.0` are ignored.
- On a fixture repository with a fake `exec`: `package.json` and
  `kit/plugin/.claude-plugin/plugin.json` both say `0.0.N`; the build runs; the commit is
  `chore(release): v0.0.N`, ends with the signature's trailer and holds only those files and the
  bundle; the tag `v0.0.N` is pushed; `gh release create` gets the bundle and `--generate-notes`.
- A head commit that is a release commit makes the script do nothing and exit 0.
- A rejected push is retried once after a rebase onto `main`; a second rejection exits non-zero with
  nothing tagged.
- `.github/workflows/release.yml` runs on push to `main`, in the `release` concurrency group with
  `cancel-in-progress: false`, with `contents: write` only, and only calls the script.
- The briefing's Never section says the release workflow's version commit is the one push to `main`
  a person does not make; an ADR records one release version for the kit, with ADR-0020 standing.
- `pnpm test` is green.

**s3**

- Through `main()` on a fixture repository with a fake `gh` and `git`, behind the latest: a worktree
  on `chore/omni-update-v0.0.15` from the remote default branch holds the new bin (mode 755), a
  `config.yml` byte-identical to before, and the one missing form, with an existing form unchanged;
  the commit is `chore(omni): update to v0.0.15` with the signature's trailer; the PR opens into the
  default branch with the compare link and the footer line; the person's checkout is unchanged.
- An open PR from that branch: its link is printed, no commit and no second PR, exit 0.
- A `config.yml` that fails the schema: the key is named, nothing is committed, exit 1.
- Up to date: nothing is written, no PR.
- `--to v0.0.12` targets that tag; an unknown tag, or `gh` failing, stops before any write, exit 1.
- From the kit's source: no bin, no worktree, no PR.
- `branches.update` defaults to `chore/omni-update-{version}` and rejects an empty value.
- `omni help` lists `update`; `pnpm test` is green, `dist.test` included.

**s4**

- Through `main()` with a fake `claude`: after the PR, `claude plugin marketplace update omni-loop`
  then `claude plugin update omni@omni-loop` run, and `run /reload-plugins` is printed.
- With no `claude`, or one that fails: `/plugin marketplace update omni-loop` and
  `/plugin update omni@omni-loop` are printed, the PR link is still printed, and the exit code is the
  repository step's.
- Up to date, and from the kit's source, the plugin step still runs.
- `omni init`'s closing steps name `omni update`; the kit README says how to update, including
  `npx github:<kit home> update` once for a repository installed before versions.
- `pnpm test` is green, `dist.test` included.
