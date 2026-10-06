# Plan: Mega PR care and mega bug fix

PRD #1118, spec beside this plan (`spec.md`). The feature branch `feat/mega-care-bug-fix` goes into
`main` with `Closes #1118`. Each slice is a sub-PR from `feat/mega-care-bug-fix--<slice>` into the
feature branch, marked `Part of #1118`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | `omni care state <n> --repo <slug> --pr <pr>` reads a target PR right (the target's default branch, its own landing chain, wave claims among its own slices, the `waits on <slug>#<pr>` line, no `fix-ci` while it waits and one `rerun` once the named PR merged), and `omni care list <n>` names every PR a mega care run looks after, in merge order | `kit/lib/care/` `kit/bin/commands/care.ts` `kit/bin/care.test.ts` `kit/dist/` | — | 1 |
| s2 | `omni bug <n>` checks a record with a `## Fixes` section (rows naming `plan.targets` repositories and their PRs, orders 1..k, one Reproduction and Guard line per row) and checks a record without it as today | `kit/lib/bug/` `kit/bin/commands/bug.ts` `kit/bin/bug.test.ts` `kit/dist/` | — | 2 |
| s3 | `/omni:mega-pr-care <n>` looks after the plan PR, every target and landing PR and every linked bug-fix PR round by round, as `/omni:pr-care` with the spec's differences, and `/omni:ultra-yolo`'s green hand-off ends with its line | `kit/plugin/skills/mega-pr-care/` `kit/plugin/skills/ultra-yolo/` `kit/lib/help/` `kit/bin/help.test.ts` `kit/test/plugin.test.ts` `kit/dist/` | s1 | 3 |
| s4 | `/omni:mega-bug-fix` opens the bug in the plan repository, plans the fix across targets (provider first), proves red and fixes each target in a linked PR, and records it in a record PR that closes the issue | `kit/plugin/skills/mega-bug-fix/` `kit/lib/help/` `kit/bin/help.test.ts` `kit/test/plugin.test.ts` `kit/dist/` | s2 | 4 |
| s5 | The several-repositories guide and its skills diagram show `/omni:mega-pr-care` and `/omni:mega-bug-fix` | `docs/guide/several-repositories.md` `docs/guide/diagrams/skills-repositories.svg` `apps/galaxy/src/docs/guide.test.ts` | — | 1 |

**Shared ground.**
- `kit/dist/` belongs to s1, s2, s3 and s4: every kit change rebuilds the committed bundle
  (`kit/test/dist.test.ts`). They sit in waves 1, 2, 3 and 4.
- `kit/lib/help/` (the entries and their count test, `kit/lib/help/entries.test.ts`, which counts
  the skill folders), `kit/bin/help.test.ts` and `kit/test/plugin.test.ts` (one describe block per
  skill) belong to s3 and s4, in waves 3 and 4. s4 raises the skill count s3 left.
- s5 touches docs only and shares no ground with any slice.

## Per slice: done when

**s1**
- On a fixture plan repository and a stubbed `gh`, `omni care state <n> --repo <target slug> --pr <pr>`
  prints a chain that restacks onto the target's default branch (read from GitHub), never the plan
  repository's, using `omni plan landings <n> --repo <name>`'s landings.
- It is `act` while a wave holds claims only on another target's slices, and `report-only` while one
  holds a claim on this target's.
- A status comment with `waits on <slug>#<pr>` and that PR open: the round lists no `fix-ci`, and the
  attempt is not bumped. That PR merged: the round lists one `rerun`. Without the line: as today.
- `omni care list <n> --json` lists the target and landing PRs (earliest wave, then
  `## Repositories`), then linked bug-fix PRs in each fix plan's order and their record PRs, then the
  plan PR last, each with its repository, number, kind and target name. A bug is linked by its
  `For PRD #<n>` line and read from its `<!-- omni-bug:fix-plan -->` comment. An unreadable
  repository is listed `unreadable`.
- `omni care list` outside a plan repository exits 2 with one line, and every existing
  `omni care` test passes unchanged.
- `pnpm test` is green, with `kit/dist/omni.mjs` rebuilt.

**s2**
- `omni bug <n>` passes a record whose `## Fixes` table has rows in order 1..k, each naming a
  `plan.targets` repository and a PR, with one Reproduction and one Guard line per row.
- It fails with one line per problem, naming the row: a repository not in `plan.targets`, a missing
  PR, a gap or repeat in the order, a missing per-target Reproduction or Guard line.
- With `## Fixes`, the check that the branch changes the reproduction is skipped. A record without
  it is checked exactly as today: the existing `kit/bin/bug.test.ts` cases pass unchanged.
- `pnpm test` is green, with `kit/dist/omni.mjs` rebuilt.

**s3**
- `kit/plugin/skills/mega-pr-care/SKILL.md` follows `/omni:pr-care` step for step and says only what
  differs, as the spec does:
  - it refuses outside a plan repository with `not a plan repository: /omni:pr-care <n>`;
  - it reads `omni care list <n>` each round and each PR's state with `--repo` and `--pr`, in merge order;
  - the waits-on judgement and its status-comment line;
  - each target's own `review` form, read in its clone;
  - the bounded cross-repository fix, replied `Fixed in <slug>@<sha>`;
  - the plan PR's **Target pull requests, in merge order** section;
  - the care line on every PR;
  - the rule that a target runs nothing but its own committed preflight;
  - never merge, never ready, never a label created in a target.
- `/omni:ultra-yolo`'s green hand-off ends with `/omni:mega-pr-care <n>`.
- `/omni:help` lists `/omni:mega-pr-care <n>` in the multi-repository group, with when to use it and
  an example. The help count tests are updated.
- `kit/test/plugin.test.ts` is green with a describe block for the skill (its name, its triggers,
  the refusal line).

**s4**
- `kit/plugin/skills/mega-bug-fix/SKILL.md` follows `/omni:bug-fix` step for step and says only what
  differs, as the spec does:
  - it refuses outside a plan repository with `not a plan repository: /omni:bug-fix`;
  - the issue in the plan repository, with `--prd` writing `For PRD #<prd>`;
  - the triage's **Repositories** line;
  - locating in the targets' clones;
  - the `<!-- omni-bug:fix-plan -->` comment, provider first;
  - the boundary: a contract change only when today's consumer keeps working, otherwise the
    `/omni:mega-brainstorm` line;
  - red proven by the target's preflight or its CI run, before the fix;
  - one PR per target, `Part of <plan slug>#<n>` and `Merge after`;
  - the record PR with `## Fixes`, proven by `omni bug <n>`, closing the issue, merged last;
  - all or nothing across targets.
- `/omni:help` lists `/omni:mega-bug-fix` in the multi-repository group, with an example. The help
  count tests are updated.
- `kit/test/plugin.test.ts` is green with a describe block for the skill (its name, its triggers, the
  refusal line, `Part of` and never `Closes` on a target PR).

**s5**
- `docs/guide/several-repositories.md` names both commands in its skills table: when to run each and
  what it leaves.
- `docs/guide/diagrams/skills-repositories.svg` draws both among the commands you type in the plan
  repository, its `<desc>` naming them.
- `apps/galaxy/src/docs/guide.test.ts` passes.
