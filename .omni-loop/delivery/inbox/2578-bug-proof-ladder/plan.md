# Plan: A bug fix proves its change before and after

PRD #2578, its spec beside this plan (`spec.md`). The feature branch `feat/bug-proof-ladder` merges
into `main` with `Closes #2578`; each slice is a sub-PR from `feat/bug-proof-ladder--<slice>` into
the feature branch, with `Part of #2578`.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | Level B is a command: `omni bug ci <n>` reads the checks of the reproduction commit and the fix commit through `gh`, writes `red.txt` and `green.txt` (masked log lines and each run's link), or prints why on one line and exits 1 | `kit/lib/bug/ci` `kit/bin/commands/bug-ci.ts` `kit/bin/commands/index.ts` `kit/bin/omni.ts` `kit/bin/bug.test.ts` `kit/lib/help/` | — | 1 | build |
| s2 | `omni bug <n>` requires the `Proved on` line with every GIF, its `reproduction test only, the screen was not filmed` mention at B and C, and a reason per level in `GIF not produced - A: …; B: …; C: …` | `kit/lib/bug/proof-body` | — | 1 | build |
| s3 | A repository's reproduction and review hooks run on a bug fix: the points `bug-fix.reproduce` and `bug-fix.review` (before, after; no replace), fired by `/omni:bug-fix` and in each target of `/omni:mega-bug-fix`, a failed one a line in the pull request | `kit/lib/flow/points` `kit/lib/flow/schema` `kit/lib/flow/show` `kit/test/flow-points.test.ts` `kit/plugin/skills/bug-fix/` `kit/plugin/skills/mega-bug-fix/` `kit/test/skill-steps.snapshot.json` `docs/guide/flow.md` | — | 1 | build |
| s4 | `/omni:bug-fix` opens its draft pull request on the reproduction alone, then takes its proof from the ladder: A at the new point `bug-fix.proof`, B through `omni bug ci`, C on its machine, D a draft naming each level's reason; `omni bug` checks the open pull request's body before it is marked ready | `kit/lib/flow/points` `kit/lib/flow/schema` `kit/lib/flow/show` `kit/test/flow-points.test.ts` `kit/plugin/skills/bug-fix/` `kit/test/bug-fix-` `kit/test/skill-steps.snapshot.json` `docs/guide/flow.md` `docs/guide/use-cases.md` | s1, s2, s3 | 2 | deep |
| s5 | `/omni:mega-bug-fix` makes one proof: `bug-fix.proof` fires once, in the target where the bug shows, handed every target's pull request, and the record's pull request carries the proof; with no hook there, today's CI red per target and a `Proved on` line that says the screen was not filmed | `kit/lib/flow/points` `kit/test/flow-points.test.ts` `kit/plugin/skills/mega-bug-fix/` `kit/test/mega-bug-fix-` `kit/test/skill-steps.snapshot.json` `docs/guide/flow.md` | s4 | 3 | build |

**Shared ground.** Five prefixes are declared by more than one slice, and the waves keep them apart:

- `kit/lib/flow/points`, `kit/test/flow-points.test.ts` and `docs/guide/flow.md` (s3, s4, s5): the
  points' catalog, the test that every skill a point lists calls `omni flow show <point>`, and the
  guide's table of points. s3 adds `bug-fix.reproduce` and `bug-fix.review` in wave 1; s4 adds
  `bug-fix.proof` listing `bug-fix` alone in wave 2; s5 adds `mega-bug-fix` to its skills in wave 3,
  so `flow-points.test.ts` is green at every wave.
- `kit/lib/flow/schema` and `kit/lib/flow/show` (s3, s4): s3 refuses a `replace` at the two points
  it adds; s4 allows `replace` at `bug-fix.proof`, one wave later.
- `kit/plugin/skills/bug-fix/` (s3, s4) and `kit/plugin/skills/mega-bug-fix/` (s3, s5): s3 adds the
  two points' calls to both skills in wave 1; s4 rewrites `/omni:bug-fix` steps 7 and 12 in wave 2,
  and s5 rewrites `/omni:mega-bug-fix`'s proof in wave 3.
- `kit/test/skill-steps.snapshot.json` (s3, s4, s5): rewording a skill never drops a step, so each
  slice that changes a skill's `omni` commands updates that skill's entry, one wave after another.

`kit/bin/bug.test.ts` is s1's alone; s2 tests the rule in `kit/lib/bug/proof-body.test.ts`. s4 reads
the `omni bug ci` and the `Proved on` rule s1 and s2 settle; it waits for both. `kit/dist/` is
generated: no slice lists it, and the wave rebuilds it once.

## Per slice: done when

### s1

- `kit/lib/bug/ci.ts` holds the pure rule, tested in `kit/lib/bug/ci.test.ts` on fixtures of checks
  and logs: the red proven when a check failed on the reproduction commit and its log names the test;
  the green proven when that same check passed on the fix commit; a skipped check named by its job;
  no failed log naming the test; every check green on the reproduction commit; a secret in the log
  masked in the excerpt (L-GDPR-2).
- `omni bug ci <n>`, handed the pull request, the reproduction commit, the fix commit, the test's
  name and an out folder, is tested through `main()` in `kit/bin/bug.test.ts` on a fixture repository
  with a fake `gh` (no call reaches GitHub): it writes `red.txt` and `green.txt`, each with the log
  lines around the test and the run's link, readable by `omni bug film`; or it prints its one line
  (`job <name> skipped`, `no failed log names <test>`, `every check passed on <commit>`, `the runs did
  not finish within <wait>`) and exits 1.
- It never edits a CI file and never changes the pull request's draft state.
- `omni help bug` names `omni bug ci`.

### s2

- `kit/lib/bug/proof-body.test.ts`: a body at level A (GIF, `Proved on: a preview environment`,
  `Preview: <url> · <lifetime>`), at B and C (GIF, `Proved on: CI · reproduction test only, the screen
  was not filmed` or `… the machine that made the fix · …`) and at D
  (`GIF not produced - A: <why>; B: <why>; C: <why>`) each passes.
- It refuses, each fault on its own line: a GIF without `Proved on`; a B or C `Proved on` without
  `reproduction test only, the screen was not filmed`; a level A `Proved on` without its `Preview`
  line; a D line missing a level or a level's reason (acceptance 5).
- A body that passed before keeps passing when it carries the new line: the `Before the fix` and
  `After the fix` rules are unchanged.

### s3

- `kit/lib/flow/points.ts` lists `bug-fix.reproduce` (handed `issue`, `branch`, `suspect`,
  `boundary`) and `bug-fix.review` (handed `issue`, `branch`, `base`), modes `before` and `after`,
  skills `bug-fix` and `mega-bug-fix`; `points.test.ts` reads them.
- `schema.test.ts`: a config with hooks at both points reads; a `replace` at either is refused,
  naming the point.
- `/omni:bug-fix` fires `bug-fix.reproduce` at step 7 before the reproduction is written, and
  `bug-fix.review` after step 9, before mutation, with the full preflight again after it (a red one
  counts as an attempt); `/omni:mega-bug-fix` fires both in each target, read from that target's
  default branch. A failed hook is one line in the pull request's **Reproduction** or **Guard**
  section, and the fix goes on (acceptance 6). `kit/test/flow-points.test.ts` passes.
- `docs/guide/flow.md` lists the two points with their modes and inputs, on nimbus.

### s4 (deep: it reorders the skill's ship step and touches the path N-PRODUCT-15 guards)

- `kit/lib/flow/points.ts` lists `bug-fix.proof`, modes `before`, `after` and `replace`, handed
  `issue`, `base`, `head`, `pr`, `targets`, `reproduction`, `out`; `omni flow show bug-fix.proof`
  prints it with its modes and inputs (acceptance 8).
- `/omni:bug-fix` commits and pushes the reproduction alone and opens the draft pull request then
  (`pr.open` fires there); pushes the fix on top; and at step 12 walks the ladder: A when
  `bug-fix.proof` passes with two readable files (`omni bug film`, `omni proof push --kind bug`, the
  `Preview` line from the hook's `env:` line); else B through `omni bug ci`; else C as today; else D,
  the pull request left a draft naming each level's reason, and a skipped job by name (acceptance 1
  to 4).
- `omni bug <n>` runs on the open pull request's body before it is marked ready, never before it
  opens; the skill never marks it ready to get a CI run.
- `kit/test/bug-fix-proof.test.ts` fails when the skill drops the early draft, a level of the ladder
  or its order, the `Proved on` line or the check before ready. The law proofs of BR-PRODUCT-3,
  BR-PRODUCT-5 and N-PRODUCT-15 in `kit/test/plugin.test.ts` pass unchanged: the slice leaves that file alone.
- `docs/guide/use-cases.md` › Fix a bug tells the ladder on nimbus-web, with a `bug-fix.proof` hook
  for a preview environment and the CI job that removes it on `pull_request: closed`;
  `docs/guide/flow.md` lists `bug-fix.proof`.

### s5

- `bug-fix.proof` lists `mega-bug-fix` beside `bug-fix`, and `kit/test/flow-points.test.ts` passes.
- `/omni:mega-bug-fix` fires `bug-fix.proof` once, in the target its triage names as the one where the
  bug shows, after every target's pull request holds its fix, with `targets` handing every target's
  repository and pull request; the record's pull request carries the proof and the target pull
  requests none (acceptance 7).
- With no hook in that target, each target keeps today's CI red, and the record's `Proved on` line
  says `reproduction test only, the screen was not filmed`.
- The `mega-bug-fix-*.test.ts` files fail when the skill drops the one proof, its target or the
  fallback; `docs/guide/flow.md` names `/omni:mega-bug-fix` beside `bug-fix.proof`.
