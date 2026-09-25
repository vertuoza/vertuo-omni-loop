# `kit/lib/inbox/territory.mjs`

Source: `scripts/check-territory.mjs` @ `vertuo-ai-domain@c4a210122`.

## Mapping applied

- Shebang line, `import { execFileSync } from 'node:child_process'`, `import { fileURLToPath } from
  'node:url'`, `import { readRepoFile, repoRoot } from './check-utils.mjs'`: all deleted. `repoRoot`
  and `check-utils.mjs` no longer exist in the kit.
- `THE_PLAN` (`'docs/superpowers/plans/2026-09-22-agent-outbox.md'`) → **deleted**, per the task's
  own instruction ("`territory.mjs` drops `THE_PLAN` and its on-disk test"). It was only ever used
  by the one on-disk test that read the real upstream repository's own plan file — see the test
  section below.
- `changedSince(base)` (shelled out to `git diff --name-only` against `repoRoot`) — **deleted**,
  per rule 3. It was the CLI half's own job (computing the diff to grade); a later task rebuilds the
  CLI, and every pure function in this module already takes an already-computed `changedPaths`
  array instead of calling this itself.
- `main(argv)` and the trailing `if (process.argv[1] === fileURLToPath(import.meta.url)) { main(…);
  process.exit(0); }` guard — **deleted**, per rule 3.
- Every other function — `territoryPrefixes`, `prefixOf`, `cells`, `isTableRow`, `isSeparatorRow`,
  `parsePlanSlices`, `covers`, `breaches`, `sharedGround`, `collisions`, `sameWaveCollisions`,
  `collisionRows`, `territoryVerdict` — is **unchanged**. None of them ever took a `root` or shelled
  out; the task's own interface list names every one of them with no new parameter, and the task's
  own clarification says this module is "pure … port their upstream tests verbatim." No literal in
  the task's own mapping table names anything in this module to replace.
- Module doc comment: reworded to drop `.claude/skills/vertuo-plan/`, `.claude/skills/vertuo-yolo/`,
  `.claude/skills/vertuo-yolo-fix/`, `vertuo-parallel-wave` (all match
  `kit/test/no-literals.test.mjs`'s `/vertuo/i` pattern) and the CLI usage line (`node
  scripts/check-territory.mjs <plan> <slice> <base>`, since the CLI is gone) in favor of generic
  wording ("a plan", "a slice", "a merge step", "two sibling directories"); adds a closing sentence
  stating the module is pure throughout, since the doc comment's own "Usage, from a skill and never
  from `package.json`" paragraph (about the CLI never being wired into `pnpm check`) no longer
  applies to anything left in this file.

## Test (`territory.test.mjs`)

Pure module, ported near-verbatim, per the task's own instruction — every case keeps its name and
its expected outcome, with only the import path and the one on-disk case affected.

- Import path: `from './check-territory.mjs'` → `from './territory.mjs'`; `THE_PLAN` and `readRepoFile`
  (`from './check-utils.mjs'`) dropped from the import list — neither exists any more.
- **No assertion values changed.** Every fixture (`PLAN`, `COLLIDING_PLAN`) and every `expect(...)`
  is byte-identical to upstream; nothing in this module's own signatures changed, so rule 6's
  "assertion may change only where it names a literal the task's mapping table replaced" never
  triggers here.
- **Deleted**, per rule 6 and the task's own explicit instruction: "the plan this slice is built
  from puts no intersecting pair in one wave" (inside `describe('Feature: Slices declare the ground
  they stand on — waves come from the collision matrix', …)`) — the one case that called
  `sameWaveCollisions(parsePlanSlices(readRepoFile(THE_PLAN)))`, reading the real upstream
  repository's own plan file off disk. Left a comment in its place naming the deletion and pointing
  at this record, so a reader of the ported file sees why the describe block has only two cases
  instead of three.

## Gate

`pnpm vitest run kit/lib/inbox/territory.test.mjs kit/test/no-literals.test.mjs` — 23/23 pass (22 in
`territory.test.mjs`, 1 in `no-literals.test.mjs`).

## Update (s14, wave 3): `parsePlanSlices` now carries `blockedBy`

Found in wave 2 (PRD 7): `omni plan check` (`kit/bin/commands/plan.mjs`) and `omni board`
(`kit/bin/commands/board.mjs`) each carried a byte-for-byte copy of `cells` / `isTableRow` /
`isSeparatorRow` / `blockedByCell` / `blockedByColumn`, because `parsePlanSlices` deliberately read
only `id`, `slice`, `territory` and `wave`. Two verbatim copies of the same table-parsing logic is
exactly the duplication the territory discipline (see the module doc comment) exists to name — so
this slice widens `parsePlanSlices` itself rather than adding a third copy, and both commands now
read `slice.blockedBy` and carry no local copy of any kind.

This is **not** a re-port from `vertuo-ai-domain`: upstream's `scripts/check-territory.mjs` never
read a `blocked by` column at all (`blocked by` grading was invented downstream, once here, twice
over, by `omni plan check` and `omni board`). It is a kit-local widening of the ported function,
recorded here per the slice's own instructions rather than in a separate porting file, since
`territory.mjs` is this record's territory.

- Added a private `blockedByCell(cell)` to `territory.mjs`, folding in the two commands' identical
  helper. One behavior change from the two removed copies: it splits on **comma or whitespace**
  (`/[\s,]+/`) rather than comma only, matching the slice's own instruction ("comma/space separated
  ids"). No existing plan in this repository (or in either command's own tests) ever wrote a
  space-only-separated `blocked by` cell, so this is strictly a widening, not a behavior change for
  any plan that already parses today.
- `parsePlanSlices` now sets `blockedBy: string[]` on every slice: the column's cell run through
  `blockedByCell`, or `[]` when the plan carries no `blocked by` column at all (a plan predating that
  column declares no blocks — this does **not** throw, unlike a missing `territory` column, which
  is loud on purpose per the function's own doc comment).
- **No existing assertion needed changing.** Every place `territory.test.mjs` compares a whole slice
  object uses `toMatchObject`, which ignores extra fields — adding `blockedBy` breaks nothing. The
  only `toEqual` calls in that file compare `collisions` / `sameWaveCollisions` / `collisionRows`
  output (plain `{ left, right, shared, ... }` pair objects, never a slice itself), so those are
  untouched too. Same story in `kit/bin/plan.test.mjs` and `kit/bin/board.test.mjs`: both drive the
  command through `main()` and assert on printed text or `toMatchObject`, not on a raw slice's key
  set.
- `kit/bin/commands/plan.mjs`: deleted its local `isTableRow`, `isSeparatorRow`, `cells`, `NOTHING`,
  `blockedByCell`, `blockedByColumn`; `blockedByViolations(slices, blockedBy)` now takes just
  `slices` and reads `slice.blockedBy` directly.
- `kit/bin/commands/board.mjs`: deleted the same six-function copy plus its own `slicesWithBlockers`
  wrapper; `board.run` now calls `parsePlanSlices(markdown)` directly. `kit/lib/board.mjs`'s
  `boardFor` already read `slice.blockedBy` (it never needed to know where that field came from), so
  it required a doc-comment update only — no behavior change.

### Gate (this update)

`pnpm test` — 970/970 pass (was 965 before this slice; +5 new `parsePlanSlices — blockedBy` cases in
`kit/lib/inbox/territory.test.mjs`, including one reading this repository's own
`.omni-loop/delivery/inbox/0007-omni-loop-skills/plan.md`). `omni plan check 7` and `omni board 7`
print byte-identical output before and after (see the s14 report).
