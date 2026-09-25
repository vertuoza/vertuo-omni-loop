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
