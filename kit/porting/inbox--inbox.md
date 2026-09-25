# `kit/lib/inbox/inbox.mjs`

Source: `scripts/inbox.mjs` @ `vertuo-ai-domain@c4a210122`.

## Mapping applied

- No shebang line and no CLI half existed in this module upstream (it exported only a parser and a
  couple of pure/file-reading helpers); nothing to delete under rule 3.
- `repoRoot`, `here` (the `fileURLToPath`/`dirname` resolution), `INBOX_DIR`, `README_FILE`,
  `BEFORE_AFTER_DIR`, `BEFORE_AFTER_MAX_BYTES`: all deleted. `INBOX_DIR`/`inboxFiles(root)` are
  replaced everywhere by `ctx.layout.specFiles()` (the task's own mapping table row); the
  before/after literals are replaced by `ctx.layout.beforeAfterPath`-shaped paths and
  `ctx.config.limits.beforeAfterMaxBytes`, both used from `check-inbox.mjs`, not from this module —
  this parser itself never touched the before/after page.
- `inboxFiles(root = repoRoot)`: **deleted**. Its one job (list every `.md` file under the flat
  inbox directory) has no folders-layout equivalent worth keeping as its own export —
  `ctx.layout.specFiles()` (`kit/lib/layout.mjs`, Task 2) already does the folders-layout
  enumeration, and its own tests already live in `kit/lib/layout.test.mjs`. Not exported by this
  task's own interface list.
- `parseInboxFile(text, { file })` → **renamed** `parseSpec(text, { file })`, per the task's own
  interface list. Still pure: markdown text in, a typed record or errors out.
  - `FrontMatterSchema` drops the required `plan: z.string().trim().min(1, …)` field entirely — the
    plan is no longer a front-matter value, ever (task's own front-matter change, spec §5). Adds an
    optional `areas: AreasSchema` field: a new `AreasSchema` (structurally identical in shape to
    `BlockedBySchema` — a bracketed, comma-separated list, but of arbitrary folder-name tokens
    rather than PRD numbers) parses `areas: [credits, quotes]` into `['credits', 'quotes']`.
    Whether each named area is a real domain folder is `check-inbox.mjs`'s own cross-file check
    (this parser has no filesystem access) — gated on `ctx.config.laws.source === 'knowledge'`,
    per the task's own clarification.
  - `unrecognizedKeyMessage(key)`: a `plan` field is now caught by `.strict()`'s
    `unrecognized_keys` path (since the schema no longer names it at all) and given its own
    message — `unexpected field "plan" — the plan is always the sibling plan.md, never a
    front-matter value` — distinct from the generic "an inbox spec names no <field>" wording kept
    for `status`/`branch`/`value`/`priority` (`FORBIDDEN_STATUS_LIKE_FIELDS`, unchanged from
    upstream).
  - The returned record drops the `plan` field (there is nothing left to carry) and adds `areas`
    only when the front matter actually named one (`...(fm.areas !== undefined ? { areas:
    fm.areas } : {})`) — a record with no `areas:` line carries no `areas` key at all, rather than
    an explicit `undefined`.
- `readInbox({ root = repoRoot } = {})` → `readInbox({ ctx })`. `inboxFiles(root)` →
  `ctx.layout.specFiles()`; `readFileSync(join(root, file), 'utf8')` → `readRepoFile(ctx, file)`
  (via a new `existsSync` guard — see below). Its returned record narrows to exactly `{ prd, title,
  blockedBy, spec, file, folder }`, per the task's own interface list — `areas` is deliberately
  left off this trusted-reader shape (a caller that needs it can read the file itself, or a future
  task can widen this); `folder` is new, `basename(dirname(file))`, since a folders-layout caller
  (status, collisions, a planner) generally needs to know which folder a record came from, and
  upstream's flat records had no folder to report at all.
  - **New existence guard.** Upstream's `inboxFiles(root)` only ever returned files that already
    existed (`readdirSync` over a real directory), so `readFileSync` never had to fail cleanly.
    `ctx.layout.specFiles()` is hypothetical — it maps every inbox folder to a `spec.md` path
    whether or not that file is actually there (`kit/lib/layout.mjs`'s own doc comment). `readInbox`
    now checks `existsSync` first and throws `readInbox: <file>: spec.md is missing` in the same
    format as its other throw, rather than leaking a raw `ENOENT` from `readFileSync`.
- Module doc comment: reworded throughout to drop `docs/inbox/<prd>-<topic>.md`,
  `docs/knowledge/product/invariants.md`, `scripts/check-inbox.mjs` path literals (`docs/` and
  `scripts/outbox.mjs`-style literals are forbidden or unnecessary for a kit module —
  `kit/test/no-literals.test.mjs` forbids `docs/`) in favor of
  `<delivery>/inbox/<prd>-<topic>/spec.md`, `ctx.layout.specFiles()`, and `check-inbox.mjs`; adds a
  paragraph on the new `areas:` field and restates the central "no status/branch/value/priority"
  rule to include "no `plan` field either."
- `parseFrontMatterLines`, `stripQuotes`, `withFile`, `FRONT_MATTER_BLOCK`, `FRONT_MATTER_LINE`,
  `BlockedBySchema`, `BLOCKED_BY_LIST`: kept, unchanged in behavior (still exported, still a private
  helper, respectively) — this task's mapping table names no change to them, and every other ported
  outbox module keeps its own private copy of the equivalent helpers rather than sharing one, so
  this module does the same.

## Test (`inbox.test.mjs`)

Per the task's own clarification, every upstream case is **rewritten** against folders fixtures
(`makeRepo`) where the front-matter change or the layout change touches it, keeping each case's
name and expected outcome; the two describe blocks that read or write a flat, root-based tree
(`inboxFiles`, `readInbox`) are rewritten with `makeRepo`/`ctx` in place of `mkdtempSync`/`root`.

- Added import: `makeRepo` (`kit/test/fixture.mjs`); `inboxText` → renamed local helper `specText`
  (matching the parser's own rename), dropping the `plan` field from its default front matter
  (there is nowhere left for it to go) and lowering the default `prd` from `1015` to `42` — an
  arbitrary but shorter number, consistent with the constant `IN = '.omni-loop/delivery/inbox'` and
  the `0042-…` folder names used throughout this task's folders fixtures (including the brief's own
  new-case snippet in `check-inbox.test.mjs`).
- `describe('parseFrontMatterLines', …)`: **ported unchanged**, pure, no root/filesystem involved —
  only the `1015`/`docs/inbox` literals in the "reads plain key: value lines" case are unaffected
  (that test builds its own literal string, not through `inboxText()`/`specText()`); its `1015` was
  updated to `42` purely to keep this file internally consistent with the new default, not because
  anything requires it.
- `describe('parseInboxFile — the happy path', …)` → renamed `describe('parseSpec — the happy
  path', …)`:
  - "parses a well-formed file into a typed record" — **assertion changed**, per the task's own
    front-matter mapping: the expected record drops the `plan:
    'docs/superpowers/plans/2026-09-23-inbox-planner.md'` field entirely (there is no `plan` field
    left to assert).
  - "coerces prd to a number", "parses a bracketed blocked-by list into numbers", "parses a
    multi-entry blocked-by list", "accepts spec: issue for a backfilled PRD" — ported unchanged
    (same names, same outcomes, just via `parseSpec`/`specText`).
  - "accepts plan: none when there is no plan yet" — **deleted**. Its entire premise (a `plan:
    none` line, and the front matter accepting it) no longer holds: `plan` is refused by name now,
    not merely accepted with a special "none" value. There is nothing left of this case to port.
  - **Added**: "accepts an optional areas list, naming knowledge domains" — not from upstream (the
    upstream schema had no `areas` field at all); added to give `parseSpec`'s own happy path at
    least one direct assertion on the new field, alongside the fuller cross-file coverage in
    `check-inbox.test.mjs`.
- `describe('parseInboxFile — the inbox file records no status …', …)` → renamed `describe
  ('parseSpec — the inbox spec records no status', …)`:
  - The four field-refusal cases (`status`, `branch`, `value`, `priority`) — ported unchanged.
  - **Added**: "refuses a file carrying a plan field, naming it — the plan is the sibling plan.md"
    — the natural fifth case alongside the existing four, proving the new refusal by name; not
    from upstream, but directly required by the task's own front-matter change (spec §5).
  - "names no business value anywhere in a well-formed record" — **assertion extended**: added
    `expect(Object.keys(result.record)).not.toContain('plan')` alongside the four pre-existing
    `not.toContain` checks. Allowed under rule 6 ("an assertion may change only where it names a
    literal the task's mapping table replaced") — `plan`'s removal from the record shape is exactly
    the task's own mapping change.
- `describe('parseInboxFile — a malformed inbox file is refused', …)` → renamed `describe
  ('parseSpec — a malformed inbox spec is refused', …)`: all seven cases ported unchanged (function
  and helper renamed, no other change); the file-label literal in "prefixes every error with the
  file when one is given" was updated from `docs/inbox/1015-bad.md` to
  `.omni-loop/delivery/inbox/0042-bad/spec.md` purely for consistency with this file's new default
  `prd`/`IN` — the `file` argument here is always an opaque label to `parseSpec`, never resolved
  against a real path, so this is not an assertion change under rule 6, just a literal restyling.
- `describe('parseInboxFile — a dependency that names no PRD is refused', …)` → renamed, one case
  ported unchanged ("fails on a blocked-by that is not a positive-integer list").
- `describe('inboxFiles', …)`: **deleted, both cases** ("returns [] when docs/inbox does not
  exist", "lists inbox files, sorted, skipping README.md"). `inboxFiles` itself no longer exists in
  the kit (rule 3/5, mapping table row 1) — replaced by `ctx.layout.specFiles()`, whose own folder
  enumeration is already covered by `kit/lib/layout.test.mjs` (Task 2). Nothing here is worth a
  second, differently-shaped test.
- `describe('readInbox', …)`: **rewritten** against folders fixtures, per the task's own
  clarification, keeping each case's name and expected outcome:
  - "returns [] on an empty tree" — `withFixtureRoot((root) => { readInbox({ root }) })` →
    `const { ctx } = makeRepo({}); readInbox({ ctx })`.
  - "reads every well-formed record" — a flat `docs/inbox/1015-inbox-and-planner.md` file →
    `${IN}/0042-inbox-and-planner/spec.md`, written through `makeRepo({ files: { … } })`; same
    assertions (`toHaveLength(1)`, `records[0].prd` — now `42`, not `1015`, since the fixture's own
    default `prd` changed).
  - "throws loudly on a malformed file rather than silently dropping it" — same restructuring,
    `readInbox({ ctx })` in place of `readInbox({ root })`; same `toThrow(/spec/)` assertion,
    unchanged.

## Gate

`pnpm vitest run kit/lib/inbox/inbox.test.mjs kit/test/no-literals.test.mjs` — 27/27 pass (26 in
`inbox.test.mjs`, 1 in `no-literals.test.mjs`).
