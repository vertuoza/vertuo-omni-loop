# `kit/lib/knowledge/check-knowledge.mjs`

Source: `scripts/check-registers.mjs` @ `vertuo-ai-domain@c4a210122`.

## Mapping applied

- `KNOWLEDGE_DIR` / `PRODUCT_DIR` / `DOMAINS_DIR` used in violation messages → `productDir(ctx)` /
  `domainsDir(ctx)` from `registers.mjs`.
- `GLOSSARY_FILE` → `ctx.config.paths.glossary`. When it is `null` (no glossary configured), a
  domain README's `Glossary term:` line must still be present (unchanged), but its word is never
  looked up — `findLayoutViolations` skips `glossaryHolds(...)` entirely in that case. This is new
  behaviour (upstream had no "no glossary configured" case; `vertuo-ai-domain` always has one) —
  exercised by the new folders-layout test (see below), which has no `domains/` folder at all, so
  the glossary-null branch itself is not directly hit by an assertion, only reachable safely.
- `OLD_REGISTER_PATHS` / `findOldRegisterCitations`: deleted per the task's own mapping table — an
  upstream migration artefact. `gradeKnowledge` no longer takes a `files: [{path,text}]` list of
  every tracked file to scan for the two dead paths; see the new meaning of `files` below.
- `findOwningLibraryViolations(knowledge, { fileExists, root })` → `findOwningLibraryViolations(ctx,
  knowledge)`. Dropped the `fileExists` injection point: no test ever overrode it (every call in the
  upstream test file passed `fileExists: existsSync`, the same default), so it was dead
  configurability once `root` became `ctx.root`. Simplified rather than carried forward literally —
  recorded as a deliberate simplification, not a mapping-table literal substitution.
- `findEntryViolations(entries, { fileExists, root })` → `findEntryViolations(ctx, entries)`. Same
  `fileExists`-drop reasoning.
- `missingPathViolations(entry, label, value, { fileExists, root, onlyPathLike })` →
  `missingPathViolations(ctx, entry, label, value, { onlyPathLike })`. Same reasoning.
- `gradeKnowledge(knowledge, { glossaryText, fileExists, root, files })` →
  `gradeKnowledge({ ctx, files, glossaryText })`, per the task brief. `knowledge` is no longer a
  parameter — it is read inside the function via `readKnowledge({ ctx })`, since the brief's
  signature is `{ ctx, files }`. `fileExists`/`root` dropped as above.
- **Return shape — required by the task brief, not a mapping-table row**: upstream returned
  `{ violations, warnings }`, arrays of `{ file, id, detail }` objects. The brief specifies
  `gradeKnowledge({ ctx, files }) → { violations: string[], wishes: string[] }`. Adapted by:
  - renaming `warnings` → `wishes` (the brief's name, matching what the objects already meant — "a
    principle no rule serves is a wish");
  - formatting every violation/wish object through a local `formatViolation({file,id,detail})` →
    `` `${file}: ${id} — ${detail}` `` string, the exact template upstream's own local `describe()`
    helper used inside `main()` for the same purpose (printing). This makes `gradeKnowledge` return
    print-ready text, consistent with `check-report.mjs`'s `formatFailure`/`formatPass` (which print
    text, never structured data) and with Task 8's `readRegisters` / Task 4's needing plain fields —
    `gradeKnowledge` itself was never in either of those consumers' interface lists, so the shape
    change does not ripple outward.
- **`files` parameter — repurposed, not just renamed**: upstream's `files` was `[{path, text}]`,
  every tracked repo file, consumed only by the now-deleted `findOldRegisterCitations`. The brief's
  `files` is a plain path array (see the folders-layout test: a list of the three knowledge-entry
  files) and is used here for the one remaining citation check —
  `findUnresolvedCitations(file, readRepoFile(ctx, file), resolve)` for every `file` in `files`.
  Upstream computed that same file list internally, unconditionally, from
  `[...new Set(knowledge.entries.map(e => e.file))]`; the port instead takes it from the caller,
  which is why the test's own `grade()` helper below still computes that exact set — the *value*
  passed is unchanged, only who computes it moved from inside `gradeKnowledge` to its caller (the
  bin, in Task 15, would call `readKnowledge({ ctx })` once and reuse its `entries` both for the
  file list and elsewhere; the pure function stopped assuming it should walk `knowledge.entries`
  itself for this one purpose).
- **`glossaryText` — kept as an escape hatch, not in the brief's signature list**:
  `findLayoutViolations`'s domain-glossary-term check needs a glossary's *text*, which upstream's
  test suite supplied directly (in-memory, decoupled from any file actually on disk — several
  ported tests write a `docs/glossary.md` fixture for unrelated heading-anchor checks while relying
  on the *default* in-memory glossary text for the term check, see e.g. "refuses a link to a heading
  the file does not have"). Forcing `gradeKnowledge` to always read `ctx.config.paths.glossary` from
  disk would have broken those tests' intent (their whole point is that the physical glossary file
  and the term dictionary are different concerns in that fixture). So `gradeKnowledge` accepts an
  optional `glossaryText` that, when given, overrides reading `ctx.config.paths.glossary` from disk;
  when omitted (the brief's plain `{ ctx, files }` call, and the new folders-layout test), it falls
  back to `ctx.config.paths.glossary ? readRepoFile(ctx, path) : ''`. This is additive — every call
  site the brief specifies still works with exactly `{ ctx, files }`.
- **Deleted check, not in the mapping table — "leads nowhere"**: upstream's `findEntryViolations`
  additionally required a `Source:` value to either name an existing path or match a
  `PRD #n` / `issue #n` / `PR #n` reference (`NUMBER_REFERENCE`); a bare word like `Source: kickoff`
  failed as "leads nowhere". The task's own folders-layout test fixture uses exactly
  `Source: kickoff` and asserts zero violations. Reinstating the check reproduces the conflict
  directly (see RED evidence in `task-3-report.md`): with it in place the fixture fails with two
  violations ("has \"Source: kickoff\", which leads nowhere."); without it, the fixture — and every
  other ported test, all of which already supply a path-like or `PRD #n`-shaped `Source:` — passes.
  The check is dropped for the port: `missingPathViolations(ctx, entry, 'Source', entry.source, {
  onlyPathLike: true })` already skips (does not fail) a non-path-like value, so `Source:` keeps
  requiring presence and requiring any *path-shaped* part of it to exist, but no longer requires the
  value to be shaped like a path or a ticket reference at all. This loosening is a policy call the
  kit is right to make generically — a host repository need not adopt `vertuo-ai-domain`'s "PRD/issue
  number" ticket convention for every `Source:` line — and the controller's own fixture is the
  clearest evidence this is the intended reading, not an oversight.

## Test (`check-knowledge.test.mjs`)

`grade(root, options)` rebuilt: `ctx = flatCtx(root)`, `knowledge = readKnowledge({ ctx })`,
`entryFiles` computed exactly as upstream computed it internally, then
`gradeKnowledge({ ctx, files: entryFiles, glossaryText: GLOSSARY_TEXT, ...options })`. Dropped
`fileExists`/`root` from the options upstream's helper injected (nothing overrode them).

**Every assertion in this file changes mechanically**, because `violations`/`wishes` are now
formatted strings instead of `{file, id, detail}` objects (the return-shape change above, required
by the brief). A `parseLine(line)` helper splits a line back into `{file, id, detail}` on the first
`": "` and the following first `" — "` (neither a file path nor an id ever contains either), so
every scenario keeps checking the same fact it checked before:

- `violation.id` / `violation.detail` / `violation.file` field access → `parseLine(violation).id`
  etc. on the string.
- `violations.map(v => v.id)` / `idsFailed()` → `violations.map(line => parseLine(line).id)`.
- `violations.map(v => v.detail)` → `violations.map(line => parseLine(line).detail)` (used where
  the original compared an array of details against `expect.stringMatching(...)`; the regex itself
  is unchanged).
- `violations.map(v => [v.file, v.id])` → `violations.map(line => [parseLine(line).file,
  parseLine(line).id])` ("refuses an Enforced by: or Source: path that does not exist").
- `violations.every(v => /does not exist/.test(v.detail))` → `violations.every(line =>
  /does not exist/.test(line))` (matching the substring directly on the full line — the regex has
  no anchors, so it still matches).
- `` `${v.id} ${v.detail}` `` anchored-regex checks (e.g. `/^BR-ADVISOR-1 has no statement/`) →
  rebuilt as `` `${parseLine(line).id} ${parseLine(line).detail}` `` — same two fields, same
  concatenation, same anchored regexes, unchanged.
- Exact-object assertions (`toEqual([{file, id, detail}])`) → exact-string assertions
  (`toEqual([`${file}: ${id} — ${detail}`])`), spelling out the same three values in the new
  template.
- `warnings` → `wishes` throughout (the brief's field rename).
- `describe('strictness — every line leads somewhere real', …)` renamed to `describe('strictness —
  a domain rule serves its own domain or the product', …)` — the literal-text scenario the dropped
  check tested is no longer in this file (see next paragraph), and the two scenarios that remain in
  this block are about cross-domain vs. domain-scoped `Serves:`, not about `Source:` shape, so the
  original heading no longer described its contents.

**Deleted, with why:**

- `it('Scenario: the old registers cannot be cited', …)` and the whole
  `describe('findOldRegisterCitations — only the settled ledger keeps its words', …)` (3 `it`s):
  `findOldRegisterCitations` itself is deleted per the mapping table (an upstream migration
  artefact); no equivalent exists to test.
- `it('refuses a Source: that is only free text, and accepts one that names a PRD or issue', …)`:
  tested the "leads nowhere" check, which is deleted (see above) — its intent ("a bare word is not
  an acceptable `Source:`") cannot survive the port unchanged, because the task's own folders-layout
  fixture requires the opposite (`Source: kickoff` must pass). Kept: the sibling assertions in the
  same `describe` block that do NOT depend on "leads nowhere" (the cross-domain-vs-product `Serves:`
  scenarios) — only this one `it` is gone.
- `describe('the knowledge folder this repo ships', …)` (1 `it`, `'grades green, the two moved
  rules serving the product principle stub'`): called `readKnowledge()` with no root, i.e. against
  the real `vertuo-ai-domain` checkout — the Port Protocol's explicit real-repo exclusion.

**Added, per the task brief (Step 4), verbatim**: the folders-layout `it('grades a knowledge folder
at the configured path with no glossary', …)` test, using `makeRepo` and the kit's default
(folders-layout) config, `.omni-loop/knowledge/...` paths, and `Source: kickoff` — see RED/GREEN
evidence in `task-3-report.md`.
