# Plan — A plan declares the contract each slice changes, and plan check refuses an undeclared one

PRD #1870, the spec beside this plan ([`spec.md`](./spec.md)). The feature branch
`feat/plan-contract-column` merges into `main` with `Closes #1870`. Each slice ships as a sub-PR
from `feat/plan-contract-column--<slice>` into the feature branch with `Part of #1870`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The config reads `contracts.declare` and a plan's `contract` column reads into `Slice.contract` (acceptance criteria 1, 2) | `kit/lib/config.ts` `kit/lib/config.test.ts` `kit/lib/types.ts` `kit/lib/inbox/territory.ts` `kit/lib/inbox/territory.test.ts` | — | 1 |
| s2 | In an ordinary repository that asks, `gradePlan` refuses an undeclared slice, and anywhere a word outside the vocabulary; `omni plan check` prints the declared contracts (criteria 3, 4, 10) | `kit/lib/inbox/plan-grade.ts` `kit/lib/inbox/plan-grade.test.ts` `kit/bin/commands/plan.ts` `kit/bin/plan.test.ts` | s1 | 2 |
| s3 | A target's copied planning config carries `contracts`, is read whatever the target's `knowledge`, and `gradePlan` asks per target from it (criteria 5, 6, 7) | `kit/lib/plan-repo/copy-flow.ts` `kit/lib/plan-repo/copy-flow.test.ts` `kit/lib/inbox/plan-grade.ts` `kit/lib/inbox/plan-grade.test.ts` | s2 | 3 |
| s4 | `omni targets` compares every target's committed planning config with its copy, `own` included, and reports a missing copy as `stale (flow not copied …)` (criterion 8) | `kit/lib/plan-repo/targets.ts` `kit/lib/plan-repo/targets.test.ts` | s3 | 4 |
| s5 | `omni flow show [--repo <name>]` prints `contracts: declare` or `contracts: none` (criterion 9) | `kit/bin/commands/flow.ts` `kit/bin/flow.test.ts` | s3 | 4 |
| s6 | The plan skill writes the column when a repository asks, mega-invade copies every target's planning config, the guide and an ADR say so (criterion 11) | `kit/plugin/skills/plan/SKILL.md` `kit/plugin/skills/mega-invade/SKILL.md` `kit/porting/plugin--plan.md` `docs/guide/flow.md` `docs/guide/several-repositories.md` `.omni-loop/knowledge/adr/0103-` | — | 1 |

**Shared ground.** `kit/lib/inbox/plan-grade.ts` and its test are declared by s2 (the refusals and
the printed line, in an ordinary repository) and s3 (the per-target ask from the copied flows): s3 is
blocked by s2, so they sit in waves 2 and 3 and never meet. Nothing else is shared: s1 owns the
config, the types and the parser; s4 and s5 own two files each, disjoint, in wave 4; s6 owns the
skills, the porting note, the guide and the record, in wave 1 beside s1, with no path in common.

## Per slice: done when

**s1 — the key and the column read (criteria 1, 2)**

- `parseConfig` reads a root `contracts` section, strict, with `declare: boolean`, `false` when the
  file has no `contracts` key; `declare: yes` (a string) and any other key under `contracts` are
  refused with a message naming `contracts.declare` (or the stray key), as the other sections refuse
  theirs.
- `Slice` (`kit/lib/types.ts`) carries `contract`: `{ kinds: ContractKind[] }` with
  `ContractKind = 'api' | 'db'`, or `'none'`, or `{ unknown: string[] }`, or `null`. The field's
  doc says which cell gives which.
- `parsePlanSlices` finds the `contract` column by name at any position; reads `api`, `db`,
  `api, db` (any spacing, any case) as kinds, `none` as `'none'`, an empty cell or an em dash as
  `null`; keeps every word outside the vocabulary (`graphql`, or `none` beside a kind) under
  `unknown`, in the cell's order; and reads `null` on every slice of a plan without the column. Its
  docblock names the vocabulary and says the grader, not the parser, refuses.
- Tests in `config.test.ts` and `territory.test.ts` prove each of those lines, written first and
  red; `pnpm mutation:changed --base origin/feat/plan-contract-column` leaves no survivor in the
  lines this slice wrote; the `config` and `inbox` floors of `mutation/floor.json` do not go down.

**s2 — the refusals, in an ordinary repository, and the printed line (criteria 3, 4, 10)**

- `gradePlan` takes what asks from `GradeConfig`, which gains `contracts`: outside a plan
  repository, a slice whose `contract` is `null` is a violation
  `<id>: contract: declares nothing — api, db, "api, db" or none` when `config.contracts.declare`
  is `true`, and no violation when it is `false`; `'none'` is never a violation.
- Wherever it sits, `{ unknown: [...] }` is a violation,
  `<id>: contract: "<word>" is no contract kind — api, db, "api, db" or none` for a word, and
  `<id>: contract: "none" beside a kind — one or the other` when `none` is among the kinds; the
  violation names its field first, like the others, and one slice with two problems lists both.
- `PlanGrade` exposes each slice's contract through `slices` (already there, via `Slice`), and
  `omni plan check` prints, after the waves and the collision matrix, one line
  `contracts: s1 api, db · s4 api` naming every slice whose kinds are non-empty, or nothing when no
  slice declares a kind; a refused plan still exits 1 with the violations after it.
- `plan-grade.test.ts` and `kit/bin/plan.test.ts` prove each line, written first; the mutation run
  leaves no survivor in the lines written; the `inbox` floor holds.

**s3 — the copy carries `contracts`, for every target (criteria 5, 6, 7)**

- `FlowConfig` is `Pick<Config, 'flow' | 'landings' | 'pr' | 'contracts'>`; `parseFlowConfig`
  picks `contracts` as it picks `landings`, ignoring every other key; `NO_FLOW.contracts.declare`
  is `false`; `hasFlow` is `true` when `declare` is `true`, with nothing else set.
- `targetFlows` returns, by short name, the copy of every target of `plan.targets` whose
  `repos/<name>/flow/config.yml` is on disk, whatever its `knowledge`; a target with no such file
  is absent; one whose file the config refuses is `{ ok: false }` as today. Its docblock no longer
  says "an imported target's".
- `gradePlan`, in a plan repository, asks per target: a `repo: <name>` row with `contract: null` is
  a violation (the s2 message) when that target's flow in `targetFlows` says `contracts.declare:
  true`, and not when its copy says `false` or is absent; the s2 refusals of unknown words apply to
  every row. `copyFlowOf`/`readCopyFlow` and the command that hands flows to the grading
  (`checkPlan`) pass the copies of every target.
- `copy-flow.test.ts` and `plan-grade.test.ts` prove each line, written first (a fixture with an
  `own` target and a `repos/<name>/flow/config.yml` on disk); the mutation run leaves no survivor;
  the `inbox` floor holds.

**s4 — `omni targets` sees every target's planning config (criterion 8)**

- `readTargets` hands `copyFlow` and the copy's evidence to `readTarget` for every target, not only
  `imported` ones; the comparison in `judged` runs whenever the target's committed config carries a
  planning key (`flow`, a non-empty `landings.alone`, `pr.openWith`, or `contracts.declare: true`):
  a copy that differs is `stale` with the detail `flow moved since read at <commit>` as today, and
  no copy at all is `stale` with a detail starting `flow not copied`; a target that commits no
  planning key and has no copy is reported exactly as today. `--json` carries the same.
- `targets.test.ts`, against the stubbed GitHub, proves the three cases on an `own` target and
  keeps every existing case green, written first.

**s5 — `omni flow show` names the ask (criterion 9)**

- `omni flow show` prints, as its last line before the hooks, `contracts: declare` when the
  repository's own config has `declare: true`, else `contracts: none`; `omni flow show --repo
  <name>` prints the same from the target's copy, `contracts: none` for a copy without the key; the
  line is in the `--json` output as `contracts: { declare: boolean }`.
- `kit/bin/flow.test.ts` proves both, on `makeRepo()` fixtures, written first.

**s6 — the skills, the guide and the record (criterion 11)**

- `kit/plugin/skills/plan/SKILL.md`, step 4: when `omni config contracts.declare` prints `true`
  (ordinary repository), or `omni flow show --repo <name>` prints `contracts: declare` for a target
  (plan repository), the header row gains `contract` after `territory`, in both variants shown; the
  rule for each word: `api` for a GraphQL type, field or argument, or a REST route or payload; `db`
  for a migration or a stored shape; both as `api, db`; `none` when the slice changes nothing for
  its callers; `—` on a slice of a repository that asks nothing; and step 5 names the three
  refusals. Step 3's table gains a `contract` row with the rule in one line.
  `kit/porting/plugin--plan.md` records the column as a departure from upstream.
- `kit/plugin/skills/mega-invade/SKILL.md`, step 3 "The flow": applies to every target, whatever
  its `knowledge` answer, for a config carrying `flow`, a non-empty `landings.alone`, a
  `pr.openWith` or `contracts.declare: true`; an `own` or `none` target gets `repos/<name>/flow/`
  and nothing else; `--sync` redraws every stale copy the same way.
- `docs/guide/flow.md` documents the `contracts.declare` key (default, what it does, the three
  words, the refusal `plan check` prints) in the shape of `landings.md`'s "The three config keys";
  `docs/guide/several-repositories.md` says the planning config of every target is copied, `own`
  included, and what `omni targets` reports when it is not.
- `.omni-loop/knowledge/adr/0103-<slug>.md`, in the README's format, status accepted, PRD #1870:
  the declaration lives in the plan and in the config of the repository that receives the slice,
  never in the plan repository; the alternatives rejected (paths, a mark on the done-when heading,
  a list in the plan repository) and the consequence that every target's planning config is copied.
- No source file changes; `pnpm check:changed` is green on the documents.
