# `kit/lib/outbox/decision-coverage.mjs`

Source: `scripts/decision-coverage.mjs` @ `vertuo-ai-domain@c4a210122`.

## Mapping applied

- `here` (`dirname(fileURLToPath(import.meta.url))`) and `repoRoot` (`join(here, '..')`): deleted,
  along with the now-unused `dirname`/`fileURLToPath`/`join` imports.
- `import { readRegisters } from './registers.mjs'` → `import { readRegisters } from
  '../knowledge/registers.mjs'` (Task 5's own location; signature grew to `readRegisters({ ctx })`).
- `STORED_SHAPE_PATH = /^libs\/[^/]+\/src\/server\/migrations\.ts$/` (module-level constant):
  deleted. `isStoredShape(change)` → `isStoredShape(change, { ctx })`, body
  `ctx.config.risk.storedShape.some((source) => new RegExp(source).test(change.path))`, per the
  task's own mapping table. `risk.storedShape` defaults to `[]` (`kit/lib/config.mjs`), so a
  repository that never sets it never fires this rule.
- `SHARED_CONTRACT_PREFIX = 'libs/system-api-contract/'`: deleted. `isSharedContract(change)` →
  `isSharedContract(change, { ctx })`, body `ctx.config.risk.sharedContract.some((prefix) =>
  change.path.startsWith(prefix))`, per the mapping table. Same `[]`-by-default behaviour.
- `LAW_TEXT_PATH` (a `docs/knowledge/…` and `docs/adr/…` regex literal): deleted. `isLawText
  (change)` → `isLawText(change, { ctx })`, body builds the equivalent pattern from
  `ctx.layout.knowledgeRoot` and `ctx.layout.adrDir` (both regex-escaped via a small local
  `escapeRegExp`, since a config path could in principle carry a `.`), per the mapping table's own
  wording: "a file directly under `<knowledgeRoot>/product/` or `<knowledgeRoot>/domains/<d>/`
  named `principles.md`/`rules.md`/`invariants.md`, any `.md` under `<knowledgeRoot>/cross-domain/`,
  or any `.md` under `ctx.layout.adrDir`".
- `enforcedByPaths({ root = repoRoot } = {})` → `enforcedByPaths({ ctx })`; body
  `readRegisters(root)` → `readRegisters({ ctx })` (Task 5's own signature). Still exported, per the
  task's own exact-exports list.
- `isLawProof(change, { root = repoRoot } = {})` → `isLawProof(change, { ctx })`, and **no longer
  exported** (not in the task's exact-exports list; nothing outside this module calls it directly —
  `riskyChanges` is the entry point). Body gained the mapping table's own gate: "only when
  `ctx.config.laws.source === 'knowledge'`; otherwise never fires" — `if (ctx.config.laws.source
  !== 'knowledge') return false;` before consulting `enforcedByPaths`, so a repository whose laws
  come from CLAUDE.md invariants or nowhere never reads the knowledge folder for this rule at all.
- `isStoredShape`, `isLawText`, `isTestRemoved`, `isSharedContract`: no longer individually
  exported either, for the same reason — the task's exact-exports list names only `riskyChanges`,
  `enforcedByPaths` and `RULE_IDS` from this module; nothing else in the kit imports any of the
  five rule functions by name.
- `export const RULES = [...]` → kept as a private (unexported) array, and a new `export const
  RULE_IDS = RULES.map((rule) => rule.id)` added, exactly `['stored-shape', 'law-proof', 'law-text',
  'test-removed', 'shared-contract']`, per the task's own `Produces:` line.
- Every `matches(change)` → `matches(change, { ctx })`, per the mapping table's "every
  `matches(change)` | `matches(change, { ctx })`" row — including `isTestRemoved`, which ignores
  the second argument (kept for a uniform call site inside `riskyChanges`).
- `riskyChanges(changes, { root = repoRoot } = {})` → `riskyChanges(changes, { ctx })`; body
  unchanged apart from threading `{ ctx }` instead of `{ root }` into every rule's `matches` call.
- `export const repoRoot = join(here, '..')`: deleted (rule 4 — context, not root).
- Module doc comment: reworded to describe `stored-shape`/`shared-contract` as config-driven
  (`ctx.config.risk`), to name the `laws.source === 'knowledge'` gate on `law-proof`, and to drop
  every `docs/knowledge/`, `docs/adr/`, `scripts/registers.mjs` literal/reference in favour of
  `ctx.layout.knowledgeRoot`, `ctx.layout.adrDir` and `readRegisters({ ctx })` (Task 5).
- No CLI half to remove: `scripts/decision-coverage.mjs` never had a
  `process.argv[1] === fileURLToPath(...)` block, so rule 3 applies vacuously (same as
  `registers.mjs` and `outbox.mjs`).

## Test (`decision-coverage.test.mjs`)

- Added imports: `makeRepo` (`kit/test/fixture.mjs`, for the new Step 4 cases), `flatCtx`
  (`kit/test/flat-layout.mjs`).
- **Fixture-root strategy changed**, matching `check-outbox.test.mjs`'s own precedent: upstream's
  `withFixtureRoot` helper (its own `mkdtempSync`/`rmSync` pair, used only by the `law-proof`
  tests) is dropped. A module-scope `let root` and `let ctx` are set fresh by a `beforeEach`
  (`root = mkdtempSync(...)`, `ctx = flatCtx(root, { risk: RISK })`) and torn down by an
  `afterEach` (`rmSync`), so every test gets a fresh fixture root and a ready `ctx` without opting
  in. The handful of tests that used to call `withFixtureRoot((root) => { ... })` now just call the
  local `seed`/`seedInvariants` helpers, which write straight into the shared `root`.
- `const RISK = { storedShape: ['^libs/[^/]+/src/server/migrations\\.ts$'], sharedContract:
  ['libs/system-api-contract/'] }` — the two upstream literals, reproduced as `flatCtx`'s own
  `risk` override, per the task's own Step 3 instruction, so every ported assertion below holds
  byte-for-byte unchanged.
- `change(path, status)`: unchanged.
- `rulesFiredOn(path, status, options)` → `rulesFiredOn(path, status = 'M')`: the `options.root`
  parameter is gone (every call now shares the `beforeEach`'s `ctx`, which already points at the
  same `root` the test's own `seed`/`seedInvariants` calls write into); body
  `riskyChanges([change(path, status)], options)` → `riskyChanges([change(path, status)], { ctx
  })`.
- Every `rulesFiredOn(path, status, { root })` call → `rulesFiredOn(path, status)` (drops the now
  redundant third argument) across every `law-proof` test ("fires on a path named by an Enforced
  by: line", "does not fire on a path the register never names", "splits a comma-separated Enforced
  by: line", "never treats the literal unenforced as a path", "the rules grow with the register",
  "also reads a domain rule's Enforced by: line", "and a cross-domain entry's Enforced by: line")
  and every `withFixtureRoot((root) => { ... })`/`seed(root, ...)`/`seedInvariants(root, ...)` call
  → the same helper without the leading `root` argument (it now closes over the shared module-scope
  `root`). No other change to any of these tests' expectations.
- Every other `rulesFiredOn(path)` / `rulesFiredOn(path, status)` call (stored-shape, law-text,
  test-removed, shared-contract, "ordinary work") and the two-rules-at-once `riskyChanges([change
  (path, 'D')], { root })` call: `{ root }` → `{ ctx }`, no assertion changed.
- **Added**, per the task's own Step 4 (not required by the mapping table's assertion-preserving
  rule, since it needs a brand-new test the upstream file has no equivalent of):
  - `describe('riskyChanges — law-proof', ...)`, one extra case: `'never fires when laws.source is
    not "knowledge", even when the register names the path'` — seeds the same `Enforced by:` line
    the first `law-proof` test uses, then rebuilds `ctx` with `laws: { source: 'none' }` and asserts
    `riskyChanges` returns `[]` for that same path. Not in the upstream file (there was no such
    concept upstream); added because the task's own mapping table calls this gate out by name and
    the ported cases alone never exercise it (`flatCtx`'s default is already `laws.source:
    'knowledge'`).
  - `describe('riskyChanges — the risky paths are config, not literals (Task 8, Step 4)', ...)` —
    the brief's own new test, verbatim in substance: with `makeRepo()`'s default (empty) `risk`
    config and the default folders layout, `libs/x/src/server/migrations.ts` fires no rule, a
    deleted `a.test.mjs` fires `test-removed`, and an edit to
    `.omni-loop/knowledge/adr/0001-x.md` (the default `paths.adr`) fires `law-text`. TDD RED
    confirmed by temporarily hard-coding `isStoredShape` back to the upstream literal regex (`return
    /^libs\/[^/]+\/src\/server\/migrations\.ts$/.test(change.path)`, ignoring `ctx`) and re-running
    `npx vitest run kit/lib/outbox/decision-coverage.test.mjs -t "the risky paths are config"`:
    failed with `expected [ {…} ] to deeply equal []` on the "empty risk config" case. GREEN
    confirmed after restoring the config-driven body: same command, 3/3 in that block; full file
    re-run afterwards, 25/25.
- **Deleted:** nothing. Every upstream test case is ported; none read the real upstream repository
  (every case here already built its own fixture text or fixture root), so Port Protocol rule 6
  never applies.

## Gate

`pnpm vitest run kit/lib/outbox/decision-coverage.test.mjs kit/test/no-literals.test.mjs` — 26/26
pass (25 in `decision-coverage.test.mjs`, 1 in `no-literals.test.mjs`).
