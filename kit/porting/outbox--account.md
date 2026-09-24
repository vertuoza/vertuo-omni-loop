# `kit/lib/outbox/account.mjs`

Source: `scripts/outbox-account.mjs` @ `vertuo-ai-domain@c4a210122`.

## Mapping applied

- `here` (`dirname(fileURLToPath(import.meta.url))`) and `repoRoot` (`join(here, '..')`): deleted,
  along with the now-unused `dirname`/`fileURLToPath` imports.
- `export const repoRoot = join(here, '..')`: deleted (rule 4).
- `import { OUTBOX_DIR, SETTLED_FILE, outboxItemFiles } from './outbox.mjs'` →
  `import { SETTLED_FILE, outboxItemFiles } from './outbox.mjs'`. `OUTBOX_DIR` no longer exists in
  the kit's `outbox.mjs` (Task 5 already removed it — `outboxItemFiles` walks
  `ctx.layout.outboxDirs()` instead); every use of the `docs/outbox` literal below is replaced by
  `` `${ctx.layout.outboxDir(prd)}` `` instead, per the task's own mapping table.
- `import { parseSettledEntries } from './outbox-settle.mjs'` → `import { parseSettledEntries }
  from './settle.mjs'` (Task 6's own rename).
- Added `import { readRepoFile } from '../check-report.mjs'` (Task 3) — every account/settled file
  read is now through this, per the convention Task 7's `check-outbox.mjs` already set.
- `ACCOUNTS_DIR`, the front-matter/heading/entry regexes and schema, `parseFrontMatterLines`,
  `parseHeadingSections`, `parseEntries`, `validateBody`, `parseAccount`, `entryKey`, `compare`: all
  unchanged — none of them read `root`, a PRD's outbox path, or a settled file.
- `readAccounts(prd, { root = repoRoot } = {})` → `readAccounts(prd, { ctx })`:
  - `const dir = join(root, OUTBOX_DIR, String(prd), ACCOUNTS_DIR);` → `const outboxDir =
    ctx.layout.outboxDir(prd); if (outboxDir === null) return [];` then `const dir =
    `${outboxDir}/${ACCOUNTS_DIR}`;`, per the mapping table's `` `${ctx.layout.outboxDir(prd)}
    /accounts` `` row. The `outboxDir === null` guard is new: `outboxItemFiles`'s own dirs
    (`ctx.layout.outboxDirs()`) only ever names a PRD that already has a real inbox/shipped folder
    or a real outbox directory, so every PRD `findFormatViolations`/`gradePrd` (Task 8's own
    `check-decision-coverage.mjs`) discover will always resolve; the guard only matters for a caller
    handing `readAccounts` a PRD number that names nothing at all, which reads as "no accounts",
    consistent with the function's own doc ("An absent `accounts/` directory … reads as `[]`, not
    an error").
  - `existsSync(dir)` → `existsSync(`${ctx.root}/${dir}`)` (still a plain string join — `dir` is
    already `ctx`-relative, matching `outboxItemFiles`'s own file list shape).
  - `const prdPrefix = `${OUTBOX_DIR}/${prd}/`;` → `const prdPrefix = `${outboxDir}/`;` — matches
    the actual dir `outboxItemFiles({ ctx })` returns paths under (which, for a shipped PRD, is
    `<shipped-dir>/outbox`, not `<outbox-dir>/<prd>`; the old literal never had to account for that
    because upstream's flat layout has no shipped state at all).
  - `const settledFile = join(root, OUTBOX_DIR, String(prd), SETTLED_FILE);` → `const settledFile =
    `${outboxDir}/${SETTLED_FILE}`;`; `existsSync(settledFile)` / `readFileSync(settledFile,
    'utf8')` → `existsSync(`${ctx.root}/${settledFile}`)` / `readRepoFile(ctx, settledFile)`.
    `parseSettledEntries(text)` → `parseSettledEntries(text, ctx.markers)`, per Task 6's own grown
    signature (this module's only call site for it).
  - `` `${OUTBOX_DIR}/${prd}/${ACCOUNTS_DIR}/${name}` `` (per-file path) → `` `${dir}/${name}` ``
    (`dir` already carries the PRD's own outbox-plus-accounts prefix).
  - `readFileSync(join(root, file), 'utf8')` → `readRepoFile(ctx, file)`.
- Module doc comment: reworded to drop `docs/outbox/<prd>/accounts/<slice>.md`,
  `scripts/outbox.mjs`, `scripts/decision-coverage.mjs` literals/references in favour of
  `` `${ctx.layout.outboxDir(prd)}/accounts` ``, "`outbox.mjs`'s own `parseOutboxItem`" and
  "`decision-coverage.mjs`".
- No CLI half to remove: `scripts/outbox-account.mjs` never had a
  `process.argv[1] === fileURLToPath(...)` block, so rule 3 applies vacuously.

## Test (`account.test.mjs`)

- Added import: `flatCtx` (`kit/test/flat-layout.mjs`). Dropped the ported file's own inline
  `withFixtureRoot` helper in favour of a module-scope `let root` set by `beforeEach`
  (`mkdtempSync`) and torn down by `afterEach` (`rmSync`) — the same shape `check-outbox.test.mjs`
  and `decision-coverage.test.mjs` already use.
- `seedItem(root, prd, id)` / `seedAccount(root, prd, slice, text)`: the leading `root` parameter is
  dropped from both (they now close over the shared module-scope `root`); bodies unchanged
  otherwise — same `docs/outbox/<prd>/...` literal paths, since these tests use `flatCtx`, whose
  own `outboxDir(prd)` is `` `docs/outbox/${Number(prd)}` ``, byte-identical to upstream's
  `OUTBOX_DIR` literal.
- Every `parseAccount(...)` call: **unchanged** — pure function, no `root`/`ctx` in its signature
  at all, so every one of the "happy path" and "refusals, by name" test cases is byte-for-byte the
  same as upstream.
- Every `readAccounts(prd, { root })` call → `readAccounts(prd, { ctx: flatCtx(root) })` (or a
  shared `const ctx = flatCtx(root)` where a test calls it more than once) — across every case in
  `describe('readAccounts', ...)`. No assertion changed; every expected shape (`results`, `.ok`,
  `.account`, `.errors`) is identical to upstream.
- `settleItem({ root, file, answer })` → `settleItem({ ctx, file, answer })`, per Task 6's own
  signature (`settle.mjs`); the one test that calls it ("reads an account whose item was settled
  since") is otherwise unchanged.
- Every `compare(risky, accounts)` call: **unchanged** — pure function, no `root`/`ctx` anywhere in
  its signature or in `compare`'s own tests.
- **Deleted:** nothing. Every upstream test case in `outbox-account.test.mjs` is ported; none reads
  the real upstream repository, so Port Protocol rule 6 never applies.

## Gate

`pnpm vitest run kit/lib/outbox/account.test.mjs kit/test/no-literals.test.mjs` — 21/21 pass (20 in
`account.test.mjs`, 1 in `no-literals.test.mjs`).
