# Plan: /omni:bug-fix, a fast lane from a bug report to one PR

PRD #556, spec beside this plan (`spec.md`). The feature branch `feat/bug-fix` merges into `main`
through the feature PR, whose body says `Closes #556`. Each slice is a sub-PR from
`feat/bug-fix--<slice>` into the feature branch, whose body says `Part of #556`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | A bug fix can be proven. Covers: `labels.bug`, `labels.regression`, `labels.riskCritical`, `labels.riskHigh`, `labels.riskMedium`, `labels.riskLow` (defaults `omni:bug`, `omni:regression`, `omni:risk-<level>`) in the config and in `omni init`'s label list; `commands.mutation` (default `null`); `omni bug <n> [--base <ref>]` printing `ok` or `not ok` with one line per failed check (one folder under `<paths.delivery>/bugs/`, its `bug.md` with the five sections filled, a risk of one of the four levels, a reproduction file that exists and the range changes, a red line, every commit signed), exit `0`, `1` or `2`; its help entry; the rebuilt bundle | `kit/lib/config` `kit/lib/init/labels` `kit/lib/bug/` `kit/bin/commands/bug.mjs` `kit/bin/commands/index.mjs` `kit/bin/bug.test.mjs` `kit/lib/help/entries` `kit/dist/omni.mjs` | — | 1 |
| s2 | A person can run `/omni:bug-fix`. Covers: the skill with the spec's inputs (a description, or an issue as `<n>`, `#<n>` or its URL), flow, boundary, stop rules, triage comment, Bug section and record, naming every label, branch, path and command through `omni config`; its help entry; its row and section in the guide's use-cases page; the delivery README's paragraph on `bugs/`; the rebuilt bundle | `kit/plugin/skills/bug-fix/` `kit/lib/help/entries` `docs/guide/use-cases.md` `.omni-loop/delivery/README.md` `kit/dist/omni.mjs` | s1 | 2 |
| s3 | Seen working. Covers: one live run of `/omni:bug-fix` on a real bug in this repository, ending in its own `omni:bug` PR into `main`, and one live stop on a report of a flaky check; both recorded in `live-run.md` beside this plan, with the links | `.omni-loop/delivery/shipped/0556-bug-fix/live-run.md` | s2 | 3 |

**Shared ground.** Two prefixes are declared by more than one slice, and the waves keep them apart:

- `kit/dist/omni.mjs` is declared by s1 (wave 1) and s2 (wave 2): each changes the kit's source and
  rebuilds the bundle with the kit's build command from the merged source, never by hand.
- `kit/lib/help/entries` is declared by s1 (the `omni bug` verb's entry, wave 1) and s2 (the
  `/omni:bug-fix` skill's entry, wave 2). The help test demands an entry for every verb and every
  skill folder, so each slice adds the entry for what it adds.

s3's own `omni:bug` PR goes into `main`, not into the feature branch, and a person merges it like
any bug fix. Only `live-run.md` is s3's sub-PR.

## Per slice: done when

**s1**

- `omni config` prints the six new label keys with their `omni:` defaults and `commands.mutation`
  as `null`, and a config that sets any of them prints the override (`kit/lib/config.test.mjs`).
- `omni init`'s label list holds the six new labels, each with a colour and a description
  (`kit/lib/init/labels.test.mjs`).
- On a fixture repository, `omni bug <n>` prints `ok` and exits `0` for a fix branch with one folder
  `<paths.delivery>/bugs/<nnnn>-<slug>/` holding a complete `bug.md` whose reproduction file the
  branch adds, every commit signed; `Guard: none — <reason>` and `Mutation: not set here` pass.
- It prints `not ok` and exits `1`, naming only that failure, for each of: no folder for `<n>`, two
  folders for `<n>`, no `bug.md`, a missing section, an empty section, a risk outside the four
  levels, no **File:** line, a reproduction file that does not exist, one the branch does not
  change, an empty **Red:** line, an unsigned commit.
- It exits `2` outside an installed repository and for a `--base` that does not resolve.
- The help lists `omni bug`, and the help test's command count moves by one.
- `kit/test/dist.test.mjs` and `kit/test/no-literals.test.mjs` are green.

**s2**

- `kit/plugin/skills/bug-fix/SKILL.md` carries the spec's flow, the boundary, the five stop rules,
  the three issue forms and the description, the triage comment with its marker, the Bug section and the record, and names no label, branch or
  path literally: `kit/test/plugin.test.mjs` and `kit/test/no-literals.test.mjs` are green.
- `/omni:help` lists `/omni:bug-fix` with one line on when to use it, and the help test is green.
- `docs/guide/use-cases.md`'s table has a row for fixing a bug, linked to its own section, which
  shows the command and what comes next.
- The delivery README has one paragraph on `bugs/<nnnn>-<slug>/`.

**s3**

- A live run on a real bug opened an `omni:bug` issue with the triage comment and its risk label,
  proved a reproduction red, and opened one PR labelled `omni:bug` that closes the issue, carries its
  `bug.md` and a filled Bug section, and had `omni bug <n>` printing `ok`.
- A live run on a report of a flaky check posted the `Kind: tooling` triage comment and opened no PR.
- `live-run.md` links both issues and the PR, and says what was seen and what was not.
