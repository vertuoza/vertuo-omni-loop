# `kit/lib/outbox/check-outbox.mjs`

Source: `scripts/check-outbox.mjs` @ `vertuo-ai-domain@c4a210122`.

## Mapping applied

- Shebang line (`#!/usr/bin/env node`): deleted. No CLI half survives (rule 3).
- `import { fail, pass, repoRoot } from './check-utils.mjs'` → deleted. `fail`/`pass`
  (`check-utils.mjs`'s CLI-printing helpers) no longer exist — replaced by
  `readRepoFile` (`kit/lib/check-report.mjs`, Task 3) for reading a file's text relative to
  `ctx.root`. `repoRoot` no longer exists — every place that used it as a default is now an
  injected `{ ctx, laws }`.
- Added `import { lawsFor } from '../laws.mjs'` (Task 4) — `findOutboxViolations` builds
  `laws = lawsFor(ctx)` once and threads it through every per-item call, per the task's own
  clarification.
- Added `import { parseSettledEntries } from './settle.mjs'` (Task 6) and
  `SETTLED_FILE` from `./outbox.mjs` — both needed by the new `Became:` check.
- `checkItemText(file, text, { root = repoRoot } = {})` → `checkItemText(file, text, { ctx, laws }
  = {})`. `ctx` is accepted, per the task's own signature, but is not itself read inside the
  function body — everything it used to need `root` for (`resolveBearsOn`, `isBelowFloor`) now
  reads the injected `laws` directly; `ctx` is only there because `findOutboxViolations` threads
  the same option bag through to every call. Noted explicitly in the module's own doc comment on
  `checkItemText` so a reader does not go looking for a use that isn't there.
  - `resolveBearsOn(item.bearsOn, { root })` → `resolveBearsOn(item.bearsOn, laws)`, per the
    mapping table (Task 4's own signature change, carried through here rather than repeated).
  - `isBelowFloor(item.bearsOn, item.rank)` → `isBelowFloor(item.bearsOn, item.rank, laws)`, same
    reason (Task 4's `isBelowFloor` grew a third `laws` parameter; this is its only call site in
    this module).
  - **Return shape changed, per the task's own clarification** ("If upstream returns objects
    rather than strings, convert with the same one-line format across old and new checks"):
    upstream returned `{ file, detail }` objects from `checkItemText`, formatted into
    `${file}: ${detail}` strings only later, by the module-level `describe({ file, detail })`
    function, itself only ever called from `main()` (now deleted) and the ported test file. The
    kit version returns `${file}: ${detail}` strings directly — the same one-line format,
    produced eagerly by a new two-argument `describe(file, detail)` helper, used at every
    violation site (the resolve failure, the floor failure, both plain-section checks, and every
    branch of `optionsViolations`) — and by the two new outbox-wide checks below, so every
    violation `findOutboxViolations` returns, old and new alike, is the exact same shape.
  - **The parse-error branch is simplified, not just reshaped.** Upstream's parse-error branch
    took `parsed.errors` — which `parseOutboxItem` already prefixes `${file}: ${message}` when
    `file` is given (see `outbox.mjs`'s own `withFile`) — and STRIPPED that prefix back off
    (`detail: message.startsWith(`${file}: `) ? message.slice(file.length + 2) : message`), only
    so the later `describe()` call could glue the same prefix back on. Since violations are now
    strings from the start, that round trip serves no purpose: `checkItemText` now simply
    `return`s `parsed.errors` unchanged on a parse failure. Byte-identical output, one fewer
    step, and nothing left over from the old object shape.
- `findOutboxViolations({ root = repoRoot } = {})` → `findOutboxViolations({ ctx })`.
  - `outboxItemFiles()` → `outboxItemFiles({ ctx })` (Task 5's own signature).
  - `readFileSync(join(root, file), 'utf8')` → `readRepoFile(ctx, file)`.
  - **New: no open item may sit inside a shipped PRD's outbox** (the task's check 2). Before
    grading a file through `checkItemText`, every file `outboxItemFiles({ ctx })` lists is checked
    against the set of dirs `ctx.layout.outboxDirs()` marks `shipped: true`; a file under one of
    those is reported as
    `` `${file}: open item in a shipped PRD — settle it or reopen the PRD` `` and `checkItemText`
    is never called for it. **Chose NOT to also grade such a file's format** (the task's own
    either/or): a shipped open item is refused for existing at all, not for how well-formed it
    is, and grading it too would print two violations for one underlying problem (settle it, or
    reopen the PRD) — the "does not also grade a shipped open item's format" test below proves
    this by seeding a file with two independent format defects (a bad `rank`, a missing section)
    and asserting exactly one violation comes back.
  - **New: every `Became:` id every `settled.md` resolves** (the task's check 1). For every dir
    `ctx.layout.outboxDirs()` names, when that dir's `settled.md` exists, its entries are read
    through `parseSettledEntries(readRepoFile(ctx, settledFile), ctx.markers)` (Task 6); every id
    in every entry's `became` list is checked against `laws.resolve(id)`, and a failure is
    reported as `` `${settledFile}: ${entry.id} Became: ${id} — ${resolved.reason}` `` — the exact
    line the task specifies, produced by the same `describe(file, detail)` helper as everything
    else (`detail = `${entry.id} Became: ${id} — ${resolved.reason}``).
  - `main()`, its `itemCount`, the `fail`/`pass` calls, the `fileURLToPath`/`process.argv` CLI
    guard: all deleted, per rule 3. Task 15 rebuilds the CLI.
- `describe({ file, detail })` (module-level, upstream): replaced by the new two-argument
  `describe(file, detail)` helper described above — same output format, called eagerly at every
  violation site instead of lazily at print time.
- Module doc comment: reworded throughout to drop `docs/outbox/<prd>`, `scripts/outbox.mjs`,
  `scripts/check-outbox.mjs`, `rework.mjs` literals (none of which exist in the kit) in favour of
  `ctx.layout.outboxDirs()`, the injected `laws` (`laws.mjs`, Task 4), and the two new checks this
  task adds.

## Test (`check-outbox.test.mjs`)

- Added imports: `makeRepo` (`kit/test/fixture.mjs`), `flatCtx` (`kit/test/flat-layout.mjs`),
  `lawsFor` (`kit/lib/laws.mjs`), `makeMarkers` (`kit/lib/markers.mjs`).
- **Fixture-root strategy changed.** Upstream ran every `checkItemText` call with an *implicit*
  default root — the real, checked-out `vertuo-ai-domain` repository — falling back to a
  `withFixtureRoot` helper (its own `mkdtempSync`/`rmSync` pair) only for the handful of tests that
  needed a *different* fixture (an ADR, a domain principle). That default no longer exists:
  `checkItemText` now always needs an explicit `laws`, and `laws.resolve` always touches
  `ctx.root` (even `resolve('none')` closes over `lawsFor(flatCtx(root))`, though it never reaches
  the filesystem for that particular id). So every test in this file now needs a *real* (if often
  empty) root, not just the ones that used to opt into `withFixtureRoot`. Replaced with a single
  module-scope `let root` set fresh by a `beforeEach` (`mkdtempSync`) and torn down by an
  `afterEach` (`rmSync`), and a module-scope `laws` object —
  `{ source: 'knowledge', resolve: (b) => lawsFor(flatCtx(root)).resolve(b), floorsHigh: (b) =>
  lawsFor(flatCtx(root)).floorsHigh(b) }` — whose closures read the *current* `root` at call time,
  so a fresh directory backs every test without every test having to say so. The `withFixtureRoot`
  helper itself is dropped; the handful of tests that used it (the ADR fixture test, the two
  "Feature: where truth lives" tests) now just `mkdirSync`/`writeFileSync` straight into the
  shared `root`, since its lifecycle is already handled.
- **`seedRegisters(root)` now runs in `beforeEach`, not per-test.** Upstream called this helper
  (writes `docs/knowledge/product/invariants.md` with `## N2`) only in the specific tests whose
  real-repo counterpart genuinely had `N2` as a live Core Invariant. Since the kit has no
  "real repo" fallback, every test that names `N2` as a `bears-on` (there are several, spread
  across `checkItemText`'s floor tests and `findOutboxViolations`' own tests) now needs it seeded
  for `N2` to resolve at all; seeding it once in `beforeEach` (harmless for the tests that never
  mention `N2`) is simpler than repeating the seed call at every site that needs it, and it makes
  the "refuses an item whose rank sits below the floor" test assert exactly the single "below the
  floor" violation the original intended, rather than an extra "does not resolve" violation the
  bare unseeded case would otherwise add (still caught by that test's own `.some(...)`, but not
  what the original meant to prove).
- Every `checkItemText(file, text)` / `checkItemText(file, text, { root })` call → `checkItemText
  (file, text, { laws })`. This is a call-signature change on every single call in the file — not
  an `expect(...)` change — required by `root` → `laws` (the task's own mapping table); listed here
  in full since it touches every test, not called out test-by-test below.
- Every `findOutboxViolations({ root })` call → `findOutboxViolations({ ctx: flatCtx(root) })`
  (the ported Steps 1–3 tests) or `findOutboxViolations({ ctx })` where `ctx` comes straight from
  `makeRepo(...)` (the new folders-layout tests, Step 4).
- **Changed assertions**, all pre-authorized by the return-shape change from `{ file, detail }`
  objects to `${file}: ${detail}` strings (task's own clarification):
  - `violations[0].file` / `.detail` property access → `violations[0]` is now the whole string;
    `expect(violations[0].file).toBe(file)` → `expect(violations[0].startsWith(`${file}:`))
    .toBe(true)`; `expect(violations[0].detail).toMatch(/rank/)` → `expect(violations[0])
    .toMatch(/rank/)`. Same two checks (file, and a substring of the reason), same tests: "refuses
    a malformed item", "an item without options is refused — a high item with one option",
    "collects violations across several item files".
  - Every `v.detail.includes(...)` / `.match(...)` / `.startsWith(...)` inside a `.some(...)`
    predicate → the same call directly on `v` (`v.includes(...)`, `/…/ .test(v)`), unchanged
    otherwise: "refuses an item missing a required section", "refuses an item whose bears-on does
    not resolve", "refuses an item whose rank sits below the floor", every case in "the two
    plain-words sections" and "the options section" describe blocks.
  - `violations.map((v) => v.detail)).toEqual([expect.stringMatching(/below the floor/)])` →
    `violations).toEqual([expect.stringMatching(/below the floor/)])` (drops the now-unneeded
    `.map`) — "Scenario: an outbox item may bear on a principle".
- **Deleted:** nothing. Every upstream test case in `check-outbox.test.mjs` is ported; none reads
  the real upstream repository (unlike `outbox.test.mjs`'s and `settle.test.mjs`'s own ported test
  files, this one never did — every case here already built its own fixture text or fixture
  root), so Port Protocol rule 6 never applies.
- **Added**, per Task 7's own Step 4, plus one extra each for symmetry:
  - `describe('Became: every id resolves (Task 7)', ...)`:
    - `'refuses a Became: id that names no knowledge entry'` — the task's own snippet, verbatim
      (folders layout via `makeRepo`, `laws.source: 'knowledge'`, a `settled.md` whose lone entry's
      `Became: P-PRODUCT-9` names nothing). TDD RED confirmed by temporarily removing the
      `Became:`-checking loop from `findOutboxViolations`: `npx vitest run
      kit/lib/outbox/check-outbox.test.mjs -t Became` failed with `expected '' to match
      /s1-01-x Became: P-PRODUCT-9/`. GREEN confirmed after restoring; same command, both tests in
      the block pass; full file re-run afterwards, 29/29.
    - `'accepts a Became: id that resolves to a real knowledge entry'` — not required by the
      brief in so many words, but the natural positive-path pair: seeds
      `.omni-loop/knowledge/product/principles.md` with a real `## P-PRODUCT-9` entry (field lines
      with no leading dash, `Source: PRD #3`, per the controller's own knowledge-fixture
      convention) and asserts `findOutboxViolations({ ctx })` is `[]` for the same settled entry
      that, unseeded, the test above refuses.
  - `describe('no open item in a shipped PRD (Task 7)', ...)`:
    - `'refuses an open item in a shipped PRD'` — the task's own snippet, verbatim (`VALID_ITEM_TEXT`,
      defined as `itemText({ frontMatter: { prd: 7 } })` right after this file's own `itemText`
      helper, per the task's clarification that it is "the valid-item fixture already defined in
      the ported upstream test file, with `prd: 7`"). TDD RED confirmed by temporarily removing the
      shipped-dir short-circuit from `findOutboxViolations`: same `-t shipped` run failed with
      `expected '' to match /open item in a shipped PRD/`.
    - `'does not also grade a shipped open item's format — one violation is enough'` — proves the
      task's either/or choice (grade OR flag, never both) actually holds, not just that a shipped
      violation appears at all: seeds a shipped item with TWO independent format defects (an
      invalid `rank`, a missing `## What I could not know` section) and asserts exactly one
      violation comes back. TDD RED confirmed in the same run as above (with the short-circuit
      removed, this test failed `expected [ …(2) ] to have a length of 1 but got 2` — proving the
      file *would* be graded, twice over, without the short-circuit). GREEN confirmed after
      restoring the implementation: both tests in the block pass; full file re-run afterwards,
      29/29.

## Gate

`pnpm vitest run kit/lib/outbox/check-outbox.test.mjs kit/test/no-literals.test.mjs` — 29/29 pass.
