# `kit/lib/outbox/outbox.mjs`

Source: `scripts/outbox.mjs` @ `vertuo-ai-domain@c4a210122`.

## Mapping applied

- `import { ID_SHAPE, resolveId } from './registers.mjs'`: removed. Laws (`kit/lib/laws.mjs`,
  Task 4) are injected into every function that used to consult the registers or ADR folder
  directly.
- `here` (`dirname(fileURLToPath(import.meta.url))`) and `repoRoot` (`join(here, '..')`): deleted,
  along with the now-unused `dirname`/`fileURLToPath` imports. Every function that took an implicit
  or default `root` now takes either `{ ctx }` (`outboxItemFiles`) or an injected `laws` object
  (`bearsOnFloorsHigh`, `floorRank`, `isBelowFloor`, `resolveBearsOn`).
- `OUTBOX_DIR = 'docs/outbox'`: deleted. `outboxItemFiles` walks `ctx.layout.outboxDirs()` instead
  of building this literal path itself.
- `ADR_DIR = 'docs/adr'` and the module-level `ADR_ID = /^ADR-(\d{4})$/`: deleted. ADR resolution
  now lives entirely in `laws.mjs` (`adrFiles`, `ADR_ID` there); this module never builds an ADR
  path again.
- `SETTLED_FILE = 'settled.md'`: unchanged, still exported.
- `bearsOnFloorsHigh(bearsOn)` body `return ID_SHAPE.test(bearsOn)` → `bearsOnFloorsHigh(bearsOn,
  laws)` body `return laws.floorsHigh(bearsOn)`, per the task's mapping table.
- `floorRank(bearsOn, proposed)` → `floorRank(bearsOn, proposed, laws)`; body unchanged except it
  calls `bearsOnFloorsHigh(bearsOn, laws)` instead of the old one-argument form.
- `isBelowFloor(bearsOn, rank)` → `isBelowFloor(bearsOn, rank, laws)`; body unchanged except it
  calls the three-argument `floorRank`.
- `resolveBearsOn(bearsOn, { root = repoRoot } = {})` (own ADR-folder scan plus
  `ID_SHAPE.test`/`resolveId` against the registers, returning `{ ok, kind }`) → `resolveBearsOn
  (bearsOn, laws)` body `return laws.resolve(bearsOn)`, per the task's mapping table. **Return
  shape changed**: upstream returned `{ ok: boolean, kind: 'none' | 'register' | 'adr' | 'unknown'
  }`; the kit version returns `laws.resolve`'s own shape, `{ ok: true } | { ok: false, reason:
  string }` — no `kind` field, a `reason` string on failure instead. Every call site and assertion
  that named `kind` was rewritten (listed under "Test" below); no caller of this function anywhere
  else in the kit reads `kind`.
- `outboxItemFiles(root = repoRoot)` (globbed `docs/outbox/<n>/*.md`, one directory level, skipping
  only `settled.md` and non-directories) → `outboxItemFiles({ ctx })`, walking every `dir` in
  `ctx.layout.outboxDirs()` (in that order), recursing into subfolders, skipping `settled.md`
  anywhere and an entire `accounts/` subfolder anywhere — the folders-layout requirement from the
  task brief's Step 4, not present in the upstream flat layout at all (there is no `accounts/`
  concept upstream; it is new kit surface, exercised only by the new test case below). Each `dir`'s
  own files are sorted by name; the overall order follows `outboxDirs()`'s order, not a global sort
  — matches `foldersLayout`'s own `outboxDirs()` ordering (in-flight folders first, then shipped).
- Module doc comment: reworded throughout to drop `docs/outbox/<prd>`, `docs/knowledge/`,
  `scripts/check-outbox.mjs`, `scripts/registers.mjs` and `rework.mjs` literals/references (none of
  which exist in the kit) in favour of `ctx.layout.outboxDirs()`, "the outbox guard" (not yet
  ported — a later task) and `laws.mjs` (Task 4, already ported). The "Where ADR resolution lives"
  paragraph is rewritten: upstream argued for keeping ADR resolution in `outbox.mjs` itself, away
  from the registers module; that argument no longer applies because ADR resolution (and knowledge-id
  resolution) both now live in `laws.mjs`, and this module has no filesystem opinion of its own —
  it only forwards to the injected `laws`.
- No CLI half to remove: `scripts/outbox.mjs` never had a
  `process.argv[1] === fileURLToPath(...)` block, so rule 3 of the Port Protocol applies vacuously
  (same as `registers.mjs`).
- Every other export (`RANK_VALUES`, `RANK_ORDER`, `REQUIRED_SECTIONS`, `PLAIN_SECTIONS`,
  `OPTIONS_HEADING`, `PERSON_STEPS_HEADING`, `OPTION_LETTERS`, `parseFrontMatterLines`,
  `parseOutboxItem`, `parseOutboxOptions`, `optionLettersInOrder`, `plainWordsProblems`, and every
  internal helper/regex/schema) is unchanged — none of them read `root`, a register or an ADR path.

## Test (`outbox.test.mjs`)

- Added imports: `makeRepo` (`kit/test/fixture.mjs`), `flatCtx` (`kit/test/flat-layout.mjs`),
  `lawsFor` (`kit/lib/laws.mjs`).
- Added a module-scope `laws` stub, per the task's own clarification, plus a module-scope `let
  root` and `afterEach` cleanup shared by every test that needs a fixture repo:
  ```js
  let root;
  afterEach(() => { if (root) rmSync(root, { recursive: true, force: true }); root = undefined; });
  const laws = {
    source: 'knowledge',
    floorsHigh: (b) => /^(N\d+|(?:P|BR|N)-[A-Z0-9]+-\d+|X-[A-Z0-9]+-[A-Z0-9]+-\d+)$/.test(b),
    resolve: (b) => lawsFor(flatCtx(root)).resolve(b),
  };
  ```
  The regex reproduces upstream's `ID_SHAPE` behaviour exactly for every sample the ported tests
  use (verified: `N1…N42` match `N\d+`; `BR-…`, `P-…`, `N-FOLDER-2` match the middle alternative;
  `X-ADVISOR-CREDITS-1` matches the last; `ADR-…` and lowercase-coded ids match none of them — same
  as `ID_SHAPE`). `resolve` closes over the mutable `root`, so pure `floorRank`/`isBelowFloor` tests
  never touch disk (they never call `laws.resolve`), and fixture tests set `root` before calling
  `resolveBearsOn`.
- `floorRank` / `isBelowFloor` describe block: every call gained the third `laws` argument
  (`floorRank(bearsOn, proposed, laws)`, `isBelowFloor(bearsOn, proposed, laws)`,
  `bearsOnFloorsHigh(bearsOn, laws)`). No other change — every original assertion (the exact
  `bearsOn`/`proposed`/expected-rank values, the whole `bearsOnSamples` property-test list) is
  byte-for-byte the same, because the regex stub is behaviourally identical to the original
  `ID_SHAPE.test`.
- `resolveBearsOn` describe block:
  - **Changed assertions** (the `{ ok, kind }` shape no longer exists):
    - `resolves "none"`: `toEqual({ ok: true, kind: 'none' })` → `toEqual({ ok: true })`.
    - `refuses a shape nothing recognizes`: `toEqual({ ok: false, kind: 'unknown' })` → asserts
      `result.ok === false` and `result.reason` matches
      `/not none, an ADR-NNNN or a knowledge id/` (the exact message `laws.mjs`'s `resolve`
      returns for that branch).
    - The three ADR fixture tests (`against a fixture repo root`): `toEqual({ ok: true, kind:
      'adr' })` / `toEqual({ ok: false, kind: 'adr' })` → `toEqual({ ok: true })` for the success
      case, and for the two failure cases, `result.ok === false` plus `result.reason` matching
      `/no decision record ADR-0001/` (the exact message `laws.mjs` returns; upstream's own
      assertion carried no message check at all, only the boolean/kind, so this is strictly more
      specific, not a change of intent).
    - Every call `resolveBearsOn(bearsOn, { root })` → `resolveBearsOn(bearsOn, laws)`; the inner
      `describe`'s own `let root` (and its own `afterEach`) were removed so that assignments to
      `root` inside its `it`s reach the shared module-scope `root` the `laws.resolve` closure
      reads — required for the new signature to see the fixture at all.
  - **Deleted** (Port Protocol rule 6 — a test case that reads the real upstream repository):
    - `it('resolves a real invariant id against the real registers', …)` — called
      `resolveBearsOn('N2')` with no root, i.e. against `vertuo-ai-domain`'s own real
      `docs/knowledge/` checkout.
    - `it('resolves a real business rule id against the real registers', …)` — same, for
      `BR-QUOTE-1`.
    - `it('refuses an id-shaped token nothing in the registers claims', …)` — same, for
      `BR-NOPE-1` and `N999` against the real registers.
    None of these three can be ported as written: the new signature has no default root/repo to
    fall back to at all (every caller must inject `laws` explicitly), so "against the real
    registers" is not an available behaviour to test any more.
  - **Added** (not required by the task, but restores the deleted tests' intent — "a knowledge id
    resolves" / "an unclaimed id-shaped token does not" — against a fixture instead of the real
    repo, using exactly the `lawsFor(flatCtx(root))` pattern the task's own clarification names for
    "resolveBearsOn cases"): `resolves a knowledge id through laws.resolve, against a fixture
    knowledge folder` (writes `docs/knowledge/product/invariants.md` with `## N1`, `Source: PRD
    #3`, then asserts `resolveBearsOn('N1', laws)` is `{ ok: true }`) and `refuses an id-shaped
    token nothing in the fixture knowledge folder claims` (empty fixture root, asserts
    `resolveBearsOn('N999', laws).ok === false`). `resolveId`/`readKnowledge` (`laws.mjs` →
    `registers.mjs`) are already covered end-to-end by `kit/lib/knowledge/registers.test.mjs` and
    `kit/lib/laws.test.mjs`; these two are here only so `resolveBearsOn`'s own knowledge-id branch
    (not just its ADR branch) has fixture coverage in this file too.
- `outboxItemFiles` describe block:
  - The two ported cases (`returns [] when docs/outbox does not exist`; `lists item files under a
    PRD directory, sorted, skipping settled.md and top-level files`): every literal path
    (`docs/outbox/985/…`, `docs/outbox/README.md`) is unchanged — `flatCtx`'s flat layout points
    `outboxDirs()` at the same `docs/outbox` upstream used. Only the call changed:
    `outboxItemFiles(root)` → `outboxItemFiles({ ctx: flatCtx(root) })`. The top-level
    `docs/outbox/README.md` file upstream excluded by name is now excluded structurally — it is not
    a PRD directory, so `flatLayout`'s own `outboxDirs()` never lists it — same observable
    behaviour, no assertion change.
  - **Added**, per the task brief's Step 4 (folders layout, `accounts/` and multi-dir ordering —
    none of which exist upstream): `lists open items in flight and in shipped folders, never
    settled.md or accounts`, using `makeRepo` and the folders layout, exactly as specified in the
    task brief. TDD evidence: RED confirmed by temporarily removing the `accounts`-directory skip
    and the `SETTLED_FILE` check from `itemFilesUnder` — the test then failed, listing
    `.omni-loop/delivery/outbox/0042-a/accounts/s1.md` and
    `.omni-loop/delivery/outbox/0042-a/settled.md` as unwanted extra entries; GREEN confirmed after
    restoring the implementation (`npx vitest run kit/lib/outbox/outbox.test.mjs` — 127/127 pass).
- No other assertion changed.

## Gate

`pnpm vitest run kit/lib/outbox/outbox.test.mjs kit/test/no-literals.test.mjs` — 128/128 pass.

## PRD 50, slice s1: the intro and the punchline

Not a re-port: upstream's `scripts/outbox.mjs` has no intro or punchline. A kit-local widening of the
ported parser, recorded here because `outbox.mjs` is this record's territory.

- New exports `FUN_SECTIONS` (`['The intro, for fun', 'The punchline, for fun']`) and
  `FUN_LINE_MAX_LENGTH` (`120`).
- `SECTION_FIELD` gained `'The intro, for fun': 'introFun'` and `'The punchline, for fun':
  'punchlineFun'`, so a parsed item exposes `sections.introFun` / `sections.punchlineFun` when it
  carries them, and neither key when it does not.
- `validateSections`: the pair is optional, together or neither, right after `PLAIN_SECTIONS` and
  before the options or person-steps heading. Three new refusals, each prefixed with the file by
  `withFile`: one of the pair without the other (the same wording as the plain pair's), the pair in
  a body with no plain sections to sit after, and (through the existing order check, which now also
  skips a lone fun heading) the pair anywhere else or swapped. An empty intro or punchline is the
  existing "has no content" refusal. A body carrying neither validates exactly as before, so every
  settled entry written before this PRD still parses.
- New pure function `funLineProblems(text)`: every `plainWordsProblems` rule on the trimmed text,
  plus `is <n> characters long — keep it to 120 characters at most` when it holds more than
  `FUN_LINE_MAX_LENGTH` code points (an emoji counts once). `plainWordsProblems` itself is unchanged;
  in particular it still allows two sentences, so an intro or punchline may be two short sentences
  (the spec's own example punchline is two) — see PRD 50's outbox item
  `s1-01-fun-line-sentence-count`.
- Module doc comment: a paragraph on the pair, and a line pointing at `funLineProblems`.

### Test (`outbox.test.mjs`)

- Added imports: `FUN_LINE_MAX_LENGTH`, `FUN_SECTIONS`, `funLineProblems` (`./outbox.mjs`),
  `makeMarkers` (`kit/lib/markers.mjs`), `parseSettledEntries` (`./settle.mjs`).
- `withSections`: its heading list gained `...FUN_SECTIONS` right after `...PLAIN_SECTIONS`. No
  existing call passes either heading, so every existing body is byte-identical.
- **Added** `parseOutboxItem — the intro and the punchline (PRD #50, slice s1)`: the pair before
  the options and before the person steps; neither (the parse is unchanged and carries no
  `introFun` key); the intro alone and the punchline alone (refused naming the file); the pair after
  the options, between the question and the decision, and swapped (out of order); the pair with no
  plain sections (refused naming the file); an empty intro. RED: the file failed to load
  (`FUN_SECTIONS is not iterable`) before the exports existed; the no-plain-sections refusal was
  also shown red by disabling its check alone (1 failed, 143 passed).
- **Added** `a settled ledger written before PRD #50 still parses`: a fixture ledger of three
  entries (an item from before the plain sections, one with options, a `human-action` one with
  person steps), read with `parseSettledEntries`; every embedded item parses, with no intro and no
  punchline.
- **Added** `funLineProblems — the rules an intro or a punchline is held to`: a plain line, exactly
  120 characters, 121 (named), an emoji counted once, a backticked name, and several rules at once.
- No existing assertion changed; none deleted.

### Gate (this update)

`pnpm vitest run kit/lib/outbox/outbox.test.mjs` — 144/144 pass.
