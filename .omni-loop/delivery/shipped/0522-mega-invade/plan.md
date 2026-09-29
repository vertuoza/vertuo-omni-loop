# Plan: mega-invade — a plan repository that knows its target repositories

PRD #522, spec in `spec.md` beside this plan. Built on the feature branch `feat/mega-invade` into
`main` (`Closes #522`), through sub-PRs from `feat/mega-invade--<slice>` into the feature branch
(`Part of #522`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | A plan repository is declared in its config (`plan.guide`, `plan.targets` with repo, role, knowledge and `readAt`; `branches.megaInvade`), every malformed `plan` section is refused field first, and `omni targets` prints one row per target — role, knowledge, loop, state (`ok`, `stale`, `drifted`, `unreachable`) — as a table or `--json`, exiting `0` only when every row is ok | `kit/lib/config.mjs` `kit/lib/config.test.mjs` `kit/lib/plan-repo/` `kit/bin/commands/targets` `kit/bin/commands/index.mjs` `kit/lib/help/` `kit/dist/` | — | 1 |
| s2 | An imported copy under `<paths.knowledge>/repos/<name>/` is checked by `omni check kb` like the repository's own knowledge, except that its evidence is never looked up on the plan repository's disk; the plan repository's registers never read it; `omni kb status --json` lists it under `targets` | `kit/lib/playbook/` `kit/lib/knowledge/` `kit/bin/commands/kb.mjs` `kit/bin/commands/check.mjs` `kit/bin/kb.test.mjs` `kit/dist/` | s1 | 2 |
| s3 | `/omni:mega-invade` (survey, one map, import, config commit, one docs-only pull request) and `/omni:mega-invade --sync` exist as a plugin skill, listed by `omni help`, and the invade guide page says how a plan repository is set up | `kit/plugin/skills/mega-invade/` `kit/lib/help/` `docs/guide/invade.md` | s1 | 2 |

**Shared ground.**
- `kit/dist/` (the committed bundle, rebuilt by `pnpm kit:build` whenever kit source changes):
  s1 in wave 1, s2 in wave 2. s3 changes no bundled source.
- `kit/lib/help/` (the entries `omni help` prints): s1 adds `targets`, s3 adds `mega-invade`;
  waves 1 and 2.
- s2 and s3 share wave 2 and no prefix: s2 is kit source under `kit/lib/playbook/`,
  `kit/lib/knowledge/` and the `kb`/`check` commands; s3 is the plugin skill, the help entries and
  the guide page.
- s2 reads the targets s1's config section declares (`kb status`'s `targets` comes from
  `plan.targets` whose `knowledge` is `imported`), hence its blocker. s3 names `omni targets`,
  which the plugin guard (`kit/test/plugin.test.mjs`) requires to exist, hence its blocker.

## Per slice: done when

**s1: the plan section and `omni targets`**

- A config with no `plan` section parses to exactly what it parses to today, and the existing
  `kit/lib/config.test.mjs` cases pass unchanged.
- `kit/lib/config.test.mjs` refuses, each with the field named first: a `repo` not in `owner/name`
  form, a duplicate `repo`, an empty `targets`, a `knowledge` other than `own`, `imported` or
  `none`, an `imported` target without `readAt`, a `readAt` on an `own` or `none` target, a
  `readAt` that is not 40 hex characters, and a `role` that is not one kebab-case word.
- `branches.megaInvade` defaults to `docs/omni-mega-invade`.
- The targets reader, on faked `gh api` answers, returns each state: `ok` for own, none, and
  imported whose head moved without touching an evidence file; `stale` for imported with a changed
  evidence file; `drifted` for an own target without the loop or without a filled form, and for an
  imported or none target that has both; `unreachable` for a repository `gh` cannot read.
- `loop` reads as the installed kit version, `installed` when the version cannot be read, or
  `not installed` when the target has no `.omni-loop/config.yml`.
- `omni targets`, through `main()` on a fixture repository with `gh` faked, prints the table in
  config order, prints the same rows with `--json` as `[{ repo, role, knowledge, loop, state,
  detail }]`, exits `0` when every row is ok and `1` otherwise, and prints
  `not a plan repository` with exit `1` when the config has no `plan` section.
- No test calls GitHub; `kit/test/no-literals.test.mjs` passes (no repository name in kit source).
- `omni help targets` prints its entry.
- `kit/dist/omni.mjs` is rebuilt, `kit/test/dist.test.mjs` passes, and `pnpm test` is green.

**s2: imported knowledge is checked, never read as the plan repository's own**

- On a fixture plan repository with a well-formed copy under `repos/vertuo-backend-php/`,
  `omni check kb` passes, although no evidence path of the copy exists on the fixture's disk.
- A copy with a malformed form or register entry makes `omni check kb` fail with the same message
  it gives for the repository's own knowledge, prefixed by the copy's path.
- `readKnowledge` on that fixture returns no entry from the copy, even when the copy holds an id
  the repository's own registers also hold.
- `omni kb status --json` has `targets: [{ repo, folder, forms, registers }]`, one per `imported`
  target, and `targets: []` in a repository without a `plan` section; its other fields are
  unchanged.
- `kit/dist/omni.mjs` is rebuilt, `kit/test/dist.test.mjs` passes, and `pnpm test` is green.

**s3: the skill**

- `kit/plugin/skills/mega-invade/SKILL.md` exists with the steps of spec point 4 (step 0, survey,
  one map, import, config as its own commit, one docs-only pull request) and point 5 (`--sync`),
  and says it never writes in a target repository and never runs anything in a clone.
- `kit/test/plugin.test.mjs` passes: the skill parses, names only commands the CLI has, and follows
  the signing and footer rules (ADR-0042).
- `omni help mega-invade` and `omni help /omni:mega-invade` print its entry.
- `docs/guide/invade.md` has a section on plan repositories naming `/omni:mega-invade`,
  `omni targets` and `--sync`; the guide's own tests pass.
- `pnpm test` is green.
