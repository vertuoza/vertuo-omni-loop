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
- **"Leads nowhere" kept exactly as upstream has it**: `findEntryViolations` still requires a
  `Source:` value to either name an existing path or match a `PRD #n` / `issue #n` / `PR #n`
  reference (`NUMBER_REFERENCE`, unchanged from upstream). This was dropped in an earlier draft of
  this port on the mistaken reasoning that the folders-layout test's original fixture (`Source:
  kickoff`) conflicted with it — per the controller's ruling, the fixture was what needed to change,
  not the check. See the folders-layout test below: it now uses `Source: PRD #3`, which
  `NUMBER_REFERENCE` accepts.

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
- `describe('strictness — every line leads somewhere real', …)` keeps its upstream name and all its
  `it`s, including `'refuses a Source: that is only free text, and accepts one that names a PRD or
  issue'` — restored after the controller's ruling; its assertions are unchanged (adapted only
  through `parseLine`, per the mechanical transformation above).

**Deleted, with why:**

- `it('Scenario: the old registers cannot be cited', …)` and the whole
  `describe('findOldRegisterCitations — only the settled ledger keeps its words', …)` (3 `it`s):
  `findOldRegisterCitations` itself is deleted per the mapping table (an upstream migration
  artefact); no equivalent exists to test.
- `describe('the knowledge folder this repo ships', …)` (1 `it`, `'grades green, the two moved
  rules serving the product principle stub'`): called `readKnowledge()` with no root, i.e. against
  the real `vertuo-ai-domain` checkout — the Port Protocol's explicit real-repo exclusion.

**Added, per the task brief (Step 4)**: the folders-layout `it('grades a knowledge folder at the
configured path with no glossary', …)` test, using `makeRepo` and the kit's default (folders-layout)
config, `.omni-loop/knowledge/...` paths. Its `Source:` fixture value is `PRD #3`, not the brief's
literal `Source: kickoff` — per the controller's ruling in "Fix round 1" (`task-3-report.md`), the
"leads nowhere" check is upstream behaviour and stays; the fixture, not the check, needed to change,
since `kickoff` names neither a path nor a PRD/issue/PR number.

## After the port: PRD #68, slice s2 — a proposed entry

Kit-only, no upstream counterpart. A proposed principle may go without `Decided:`; an entry's
`problems` (a malformed `Proposed:` line) are violations; `findProposals` reports each proposed entry
once, and `gradeKnowledge` returns them as `proposals` beside `wishes`, which `omni check knowledge`
prints as warnings. Every other line is graded as before, for a proposed entry too. Tests added in
`check-knowledge.test.mjs`; no ported assertion changed.
