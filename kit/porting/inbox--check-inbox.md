# `kit/lib/inbox/check-inbox.mjs`

Source: `scripts/check-inbox.mjs` @ `vertuo-ai-domain@c4a210122`.

## Mapping applied

- Shebang line, `import { fileURLToPath } from 'node:url'`, `main()`, `describe({ file, detail })`
  (the module-level print-time formatter) and the `if (process.argv[1] === …) main();` guard: all
  deleted, per rule 3. `fail`/`pass`/`repoRoot` (`./check-utils.mjs`, which no longer exists in the
  kit) go with them.
- `import { BEFORE_AFTER_DIR, BEFORE_AFTER_MAX_BYTES, inboxFiles, parseInboxFile } from
  './inbox.mjs'` → `import { parseSpec } from './inbox.mjs'`. `BEFORE_AFTER_DIR`/
  `BEFORE_AFTER_MAX_BYTES` no longer exist (folders layout puts a size cap on the per-folder
  `before-after.html`, read from `ctx.config.limits.beforeAfterMaxBytes` instead — mapping table
  row 3); `inboxFiles` no longer exists (`ctx.layout.specFiles()` instead — mapping table row 1);
  `parseInboxFile` is renamed `parseSpec` (Task 12's own rename, `inbox.mjs`).
- Added `import { readRepoFile } from '../check-report.mjs'` (Task 3's convention, every other
  ported `check-*.mjs` module already reads a repo file through it rather than
  `readFileSync(join(root, file), 'utf8')` directly).
- Added `import { domainsDir } from '../knowledge/registers.mjs'` and a new local `knownAreas(ctx)`
  — reuses `registers.mjs`'s own canonical `<knowledgeRoot>/domains` path builder rather than
  restating the join, but deliberately does **not** call `readKnowledge({ ctx })`: that function
  fully parses every entry in the knowledge tree (and can itself throw or report on malformed
  entries), which is `check-knowledge.mjs`'s job, not this checker's — `findInboxViolations` only
  needs to know which folder names exist under `domains/`, a plain `readdirSync` listing of
  directories.
- `violationsForFile(file, text, root)` (upstream, took a bare `root`) → `violationsForFile(file,
  folder, text, ctx)` (this task's own helper, now also takes the file's own `folder` name, derived
  by both call sites via `basename(dirname(file))`). Its old job — parse, then check `plan`
  resolves — is replaced by three folders-layout checks, per the task's own step 2/clarifications:
  - **`plan` resolution is gone entirely.** Upstream's `if (record.plan !== 'none' &&
    !existsSync(join(root, record.plan))) …` has no folders-layout equivalent: `plan` is refused by
    `parseSpec` itself now (`inbox.mjs`), so a record that reaches this function never carries one.
    A missing `plan.md` is explicitly **not** graded here, per the task's own clarification ("A
    missing plan.md is not a violation") — this checker never even looks for the file.
  - **New: `prd` must agree with its own folder's number.** `parseFolderName(folder)?.prd` (`Task
    2`'s `layout.mjs`) compared against `record.prd`; a mismatch is reported as
    `` `${file}: prd ${record.prd} does not agree with its folder's number, ${folderPrd}
    ("${folder}").` ``, per the task's own mapping table row 2 ("the prd: field … must equal the
    folder's number … mismatch is a violation").
  - **New: `areas` must name real domain folders, gated on `laws.source`.** Only when
    `ctx.config.laws.source === 'knowledge'` (task's own clarification) does each `record.areas`
    entry get checked against `knownAreas(ctx)`; an unknown one is reported as `` `${file}: areas
    names "${area}", which is not a folder under ${domainsDir(ctx)}.` ``. Under any other
    `laws.source`, `areas` is accepted as-is (parsed structurally by `parseSpec`, never checked for
    existence here) — exactly the task's own clarification.
- `checkInboxText(file, text, { root = repoRoot } = {})` → `checkSpecText(file, text, { ctx })`
  (renamed, per the task's own interface list). **Return shape changed, following the convention
  every check module ported since Task 7 already uses**: upstream returned `{ file, detail }`
  objects; `checkSpecText` returns `` `${file}: ${detail}` `` strings directly, produced eagerly at
  every violation site inside `violationsForFile` (there is no lazy `describe({file,detail})`
  formatter left to call at print time) — the one-line `<file>: <detail>` shape Task 7 established
  for `findOutboxViolations` and every checker since.
- `blockedByViolations(records)` (upstream, checked only against the other records passed in) →
  `blockedByViolations(records, ctx)`: now checks `ctx.layout.whereIs(prd)` instead of `new
  Set(records.map((r) => r.prd)).has(prd)`, per the task's own clarification ("blocked-by must name
  a PRD that exists (in inbox or shipped via ctx.layout.whereIs)"). A blocked-by naming a PRD that
  has already shipped is now accepted, which upstream's flat layout (with no "shipped" concept at
  all) could never express. Violation text updated to say "no inbox or shipped folder carries"
  (was "no inbox file carries"). Also returns `${file}: …` strings directly now, same reshaping as
  above.
- `beforeAfterViolations(root)` (upstream: scanned every `.html` file under one shared
  `docs/public/inbox/` directory) → **replaced** by a new per-folder `beforeAfterViolation(file,
  ctx)`, called once per spec folder inside `findInboxViolations`'s own loop, at
  `` `${dirname(specFile)}/before-after.html` ``: the folders layout puts (at most) one
  `before-after.html` per PRD folder, sibling to `spec.md`, so there is no longer a directory of
  arbitrarily-named html files to scan or filter by extension — there is exactly one fixed path per
  folder to check, or none. Reads `ctx.config.limits.beforeAfterMaxBytes` in place of the deleted
  `BEFORE_AFTER_MAX_BYTES` constant (mapping table row 3). Returns the same `${file}: is ${size}
  bytes, over the ${cap}-byte cap.` wording, unchanged.
- `findInboxViolations({ root = repoRoot } = {})` → `findInboxViolations({ ctx })`. `inboxFiles
  (root)` → `ctx.layout.specFiles()` (mapping table row 1). **New: a spec.md that
  `ctx.layout.specFiles()` names but that does not exist on disk is its own violation**,
  `` `${specFile}: spec.md is missing.` `` — upstream's `inboxFiles(root)` only ever listed files
  that already existed (a real `readdirSync`), so this case could not previously arise; folders'
  own `specFiles()` is hypothetical (`kit/lib/layout.mjs`'s own doc comment: it maps every
  inbox-shaped folder to a `spec.md` path whether or not the file exists), so a folder with only a
  `plan.md` and no `spec.md` needs its own guard.

## Test (`check-inbox.test.mjs`)

Rewritten against folders fixtures throughout, per the task's own clarification, keeping each
upstream case's name and expected outcome where its premise still holds.

- Added imports: `makeRepo` (`kit/test/fixture.mjs`). `checkInboxText` → `checkSpecText`,
  `findInboxViolations` unchanged in name. `inboxText` → local `specText` (same shape/defaults as
  `inbox.test.mjs`'s own helper — each ported test file keeps its own copy, per the existing
  convention).
- `describe('checkInboxText', …)` → `describe('checkSpecText', …)`:
  - "finds nothing wrong with a well-formed file whose plan is \"none\"" → renamed "finds nothing
    wrong with a well-formed spec" (there is no `plan` field left to be "none"); same outcome
    (`toEqual([])`), now via `checkSpecText(file, specText(), { ctx })` with `ctx = makeRepo({}).ctx`.
  - "refuses a malformed file, naming the file and the reason" → renamed "refuses a malformed spec,
    naming the file and the reason". **Assertion reshaped**, per the return-shape change above:
    `violations[0].file`/`.detail` → `violations[0].startsWith(`${file}:`)` /
    `expect(violations[0]).toMatch(/spec/)` — same two checks (the file, and a substring of the
    reason), same case.
  - "refuses a file carrying a status field, naming it" → renamed "refuses a spec carrying a status
    field, naming it"; `v.detail.includes('status')` → `v.includes('status')`, same reshaping.
  - "refuses a file whose plan path does not exist on disk" and "accepts a file whose plan path
    exists on disk" — **both deleted**. Plan-path resolution no longer exists anywhere in this
    module (`plan` is refused by `parseSpec` itself); there is nothing left of either case's premise
    to port. Replaced conceptually by the new prd/folder-mismatch and areas checks below.
  - **Added**: "refuses a prd that disagrees with its own folder's number" — direct
    `checkSpecText`-level coverage of the new check, alongside the brief's own `findInboxViolations`
    -level version of the same rule (see below); not from upstream.
- `describe('findInboxViolations', …)`:
  - "passes on an empty tree", "passes on a tree of well-formed fixture files" (renamed "… fixture
    folders") — ported, rewritten onto `makeRepo`/folders (`${IN}/0042-inbox-and-planner/spec.md`,
    `${IN}/0966-agent-outbox/spec.md` in place of the flat `docs/inbox/1015-….md` /
    `docs/inbox/0966-….md` files); same outcome (`toEqual([])`).
  - "collects violations across several files, each naming its own file" (renamed "… several
    folders, each naming its own file") — ported, rewritten onto two folders
    (`${IN}/0042-good/spec.md`, `${IN}/0043-bad/spec.md`); **assertion reshaped**: `v.file === '…'`
    → `v.startsWith('…/spec.md:')`, same return-shape reason as above.
  - `describe('a dependency that names no PRD is refused', …)`: both cases ported, rewritten onto
    folders; "accepts a blocked-by naming a PRD an inbox file does carry" renamed "… an inbox
    folder does carry". **Added**: "accepts a blocked-by naming a PRD that has already shipped" —
    new behavior this task adds (`ctx.layout.whereIs` also resolves a shipped folder, not only an
    inbox one); not from upstream, proven with its own `.omni-loop/delivery/shipped/0007-done/`
    fixture. TDD RED confirmed by temporarily reverting `blockedByViolations` to upstream's
    inbox-only `Set` check: `npx vitest run kit/lib/inbox/check-inbox.test.mjs -t "already
    shipped"` failed with `expected [ Array(1) ] to deeply equal []` (the shipped PRD was reported
    as unresolved). GREEN confirmed after restoring; full file re-run, 21/21.
  - `describe('an oversized page is refused', …)`: rewritten onto one folder's own
    `before-after.html` (`${IN}/0042-inbox-and-planner/before-after.html`) in place of a shared
    `docs/public/inbox/` directory of files.
    - "refuses a before/after page over the size cap, naming its size" — ported, same 512001-byte
      fixture and message assertion, now `.startsWith(`${IN}/…/before-after.html:`)`.
    - "accepts a before/after page at or under the cap" — ported unchanged in outcome (512000
      bytes → `[]`).
    - "does not look at a non-html file under docs/public/inbox" → **rewritten**, renamed "does not
      look at another file in the folder, only before-after.html": the folders layout has no
      directory of arbitrarily-named html files to filter by extension — there is exactly one fixed
      filename (`before-after.html`) per folder to check. Kept the spirit of the original case (an
      oversized *other* file must not be graded) by seeding a 600 000-byte `notes.txt` alongside a
      well-formed spec in the same folder and asserting `[]`.
    - "passes when docs/public/inbox does not exist at all" → **rewritten**, renamed "passes when a
      folder has no before-after.html at all": a folder with only `spec.md` and no
      `before-after.html`, same outcome (`[]`).
- **Task 12's own new test block** (task-12-brief.md, Step 3), added verbatim as the brief gives
  it, at the end of the file (its own local `spec`/`violations` helpers, not the file's `specText`):
  "accepts a well-formed spec", "refuses a plan: field — the plan is the sibling plan.md", "refuses
  a prd: that disagrees with the folder number", "refuses a missing spec.md in an inbox folder",
  "accepts areas: naming knowledge domains, refuses an unknown one", "refuses a before-after page
  over the configured cap", "still refuses status, branch, value and priority by name".
  - TDD RED confirmed for each new implementation branch by temporarily removing it and re-running
    the affected case(s):
    - prd/folder mismatch removed → both "refuses a prd that disagrees with its own folder's
      number" (`checkSpecText`) and "refuses a prd: that disagrees with the folder number"
      (`findInboxViolations`, the brief's own case) failed (`expected false to be true` /
      `expected '' to match /0042-a.*43|43.*0042-a/s`).
    - `areas` check removed → "accepts areas: naming knowledge domains, refuses an unknown one"
      failed (`expected '' to match /nope/`).
    - the missing-`spec.md` guard short-circuited → "refuses a missing spec.md in an inbox folder"
      failed loudly with an uncaught `ENOENT` from `readRepoFile` (proving the guard is
      load-bearing, not merely cosmetic).
  - GREEN confirmed after restoring each: full file re-run, 21/21; full `pnpm test`, 715/715.

## Gate

`pnpm vitest run kit/lib/inbox/check-inbox.test.mjs kit/test/no-literals.test.mjs` — 22/22 pass
(21 in `check-inbox.test.mjs`, 1 in `no-literals.test.mjs`). Full `pnpm test` — 715/715 pass.
