# `kit/lib/outbox/status.mjs`

Source: `scripts/outbox-status.mjs` @ `vertuo-ai-domain@c4a210122`.

## Mapping applied

- Shebang line (`#!/usr/bin/env node`) and the trailing
  `if (process.argv[1] === fileURLToPath(import.meta.url)) main();` guard: deleted. No CLI half
  survives (rule 3). `main`, `parseArgs`, and `branchChanges` (the `git diff --name-status`
  shelling — the CLI's own job, never called from a pure function) are all deleted along with
  every import only they used (`appendFileSync`, `execFileSync`, `fileURLToPath`, and the `$GITHUB_
  OUTPUT`/`$GITHUB_STEP_SUMMARY` plumbing). A later task rebuilds the CLI half.
- `OVERRIDE_LABEL` (`'outbox:go'`, a module constant): deleted, per the task's own mapping table
  (`OVERRIDE_LABEL` → `ctx.config.labels.outboxGo`). It is no longer exported — nothing in the
  task's exact-exports list names it, and no literal `'outbox:go'` may appear in a non-test `.mjs`
  file (`kit/test/no-literals.test.mjs`). Its one read site (`labels.includes(OVERRIDE_LABEL)`,
  inside `gateResult`) becomes `labels.includes(ctx.config.labels.outboxGo)`.
  - **Consequence for `formatReport`'s override line (controller ruling, fix round 1).**
    Upstream's override line named the literal label text: `` `${OVERRIDE_LABEL} — override in
    effect; waved through.` ``. `formatReport`'s own signature is fixed by the task at
    `formatReport(prd, result)` — no `ctx` — so it cannot read `ctx.config.labels.outboxGo` at
    print time itself. Rather than drop the label name from the printed line (this port's first
    attempt), `gateResult` now also returns `overrideLabel: ctx.config.labels.outboxGo` on every
    result (both the `changes === null` and the `changes`-graded branch), and `formatReport` prints
    `` `${result.overrideLabel} — override in effect; waved through.` `` — byte-identical to
    upstream's own text whenever the label is left at its default (`'outbox:go'`). See the test
    assertion this restores, below.
- `` `${OUTBOX_DIR}/${prd}/` `` (in `openItemFiles`): → `` `${ctx.layout.outboxDir(prd)}/` ``, per
  the task's own mapping table row. **New null guard added**: `ctx.layout.outboxDir(prd)` can
  return `null` (a PRD with no folder at all), which `` `${OUTBOX_DIR}/${prd}/` `` never could
  upstream (`OUTBOX_DIR` was always a fixed string) — `openItemFiles` returns `[]` in that case,
  per the task's own clarification ("a PRD with no folder has nothing open").
- `import { OUTBOX_DIR, outboxItemFiles, parseOutboxItem, repoRoot } from './outbox.mjs'` →
  `import { outboxItemFiles, parseOutboxItem } from './outbox.mjs'` (`OUTBOX_DIR`/`repoRoot` no
  longer exist in the kit's `outbox.mjs`; `outboxItemFiles`'s own signature grew to
  `outboxItemFiles({ ctx })`, Task 5).
- `import { compare, readAccounts } from './outbox-account.mjs'` →
  `import { compare, readAccounts } from './account.mjs'` (Task 8's own rename); `readAccounts`'s
  signature is now `readAccounts(prd, { ctx })`.
- `import { riskyChanges } from './decision-coverage.mjs'`: path unchanged; signature now
  `riskyChanges(changes, { ctx })` (Task 8).
- Added `import { readRepoFile } from '../check-report.mjs'` (Task 3) — `describeItem` now reads a
  file's text through it instead of `readFileSync(join(root, file), 'utf8')`, the convention every
  other ported outbox module already follows.
- `describeItem(file, { root = repoRoot } = {})` → `describeItem(file, { ctx })`;
  `readFileSync(join(root, file), 'utf8')` → `readRepoFile(ctx, file)`.
- `openItemFiles(prd, { root = repoRoot } = {})` → `openItemFiles(prd, { ctx })` (see above).
- `openItems(prd, { root = repoRoot } = {})` → `openItems(prd, { ctx })`.
- `unaccountedChanges(prd, changes, { root = repoRoot } = {})` → `unaccountedChanges(prd, changes,
  { ctx })`; body threads `{ ctx }` into `riskyChanges` and `readAccounts` instead of `{ root }`.
- `gateResult(prd, { root = repoRoot, labels = [], changes = null } = {})` → `gateResult(prd, {
  ctx, labels = [], changes = null } = {})`.
- **New: a third reason to be red (this task).** `unreworkedDrift(prd, { ctx })` reads
  `` `${outboxDir}/settled.md` `` (`SETTLED_FILE` from `outbox.mjs`) through
  `parseSettledEntries(text, ctx.markers)` (Task 6) and returns `{ id, closedLine }[]` for every
  entry whose `verdict === 'drifted' && !entry.closed` — `closedLine` is the raw `Closed:` field
  value (`entry.fields.Closed`), per the task's own clarification. A PRD with no folder, or a
  folder with no `settled.md` yet, returns `[]`. `gateResult` now also computes `unreworked =
  unreworkedDrift(prd, { ctx })` and folds it into `ok`: `ok = overridden || (items.length === 0 &&
  unreworked.length === 0 && (unaccounted?.length ?? 0) === 0)`, per the task's own exact formula.
  Both the no-`changes` and the `changes`-graded branches of `gateResult` now always carry an
  `unreworked` field (new field on the result, in both branches — the task's own exact-exports
  list; `unaccounted` alone stays conditional on `changes`, unchanged).
- `formatReport(prd, result)`: unchanged signature. **New**: when `result.unreworked` is non-empty,
  appends `` `${n} drifted decision${n === 1 ? '' : 's'} not yet reworked — run ${COMMANDS.yoloFix}
  #${prd}` `` (per the task's own exact wording, with `COMMANDS.yoloFix` = `/omni-yolo-fix`) followed
  by one `  - <id>` line per entry, via a new `formatUnreworked` helper — placed between the
  open-item block and the unaccounted-change block. Reads `result.unreworked ?? []` defensively so
  the three ported `formatReport`-only tests below (which build a bare result literal by hand, with
  no `unreworked` field at all — they are not `gateResult`'s own output) keep working unchanged.
  Added `import { COMMANDS } from '../commands.mjs'` for this line.
- Module doc comment: reworded throughout to drop `docs/outbox/<prd>`, `scripts/outbox.mjs`,
  `scripts/outbox-account.mjs`, `.github/workflows/outbox.yml` literals/references in favour of
  `ctx.layout.outboxDir(prd)`, `account.mjs`, `outbox.mjs`'s own parser, and `kit/bin` (a later
  task); adds a paragraph naming the third (drift) reason for the gate to be red, this task's own
  addition, alongside the existing PRD #985/#1044 paragraphs it already carried.
- `$GITHUB_OUTPUT`/`$GITHUB_STEP_SUMMARY` appending: deleted along with `main` (rule 3) — this was
  entirely inside the CLI half.

## Test (`status.test.mjs`)

- Added imports: `flatCtx` (`kit/test/flat-layout.mjs`), for every ported (Step 3) case;
  `makeRepo` (`kit/test/fixture.mjs`) and `makeMarkers` (`kit/lib/markers.mjs`), for the three new
  (Step 4) drift cases, which use the default folders layout rather than `flatCtx`, exactly as the
  task's own new cases are written.
- Every `{ root }` passed to `openItemFiles`, `openItems`, or `gateResult` → `{ ctx: flatCtx(root)
  }` (or a shared `const ctx = flatCtx(root)` where a test calls a function more than once), per
  Port Protocol rule 6. No assertion's *value* changed by this substitution alone.
- `import { OVERRIDE_LABEL, formatReport, gateResult, openItemFiles, openItems } from
  './outbox-status.mjs'` → `import { formatReport, gateResult, openItemFiles, openItems } from
  './status.mjs'` — `OVERRIDE_LABEL` is no longer exported (see the module's own mapping notes
  above). Every `labels: ['pr:feature', OVERRIDE_LABEL]` call site → `labels: ['pr:feature',
  ctx.config.labels.outboxGo]` (`ctx.config.labels.outboxGo` defaults to `'outbox:go'`,
  `kit/lib/config.mjs`, so this holds the exact same value the ported cases already exercised).
- `import { adoptItem } from './outbox-settle.mjs'` → `import { adoptItem } from './settle.mjs'`
  (Task 6's rename); its one call site: `adoptItem({ root, itemText })` → `adoptItem({ ctx,
  itemText })`.
- **Assertions changed, per the task's own mapping table (`OVERRIDE_LABEL` → `ctx.config.labels.
  outboxGo`) and rule 6:**
  - `gateResult('985', { root })` → `{ ok: true, items: [], overridden: false }` (two `toEqual`
    call sites: "is green on an empty tree", and the adopted-medium-item describe block) → both
    gained `unreworked: []` and `overrideLabel: 'outbox:go'`, since `gateResult` now always returns
    both fields (`ctx.config.labels.outboxGo` defaults to `'outbox:go'`).
  - The range describe block's `` expect(result).toEqual({ ok: true, items: [], overridden: false,
    unaccounted: [] }); `` ("is green when there is no open item and the range holds nothing
    risky") → gained `unreworked: []` and `overrideLabel: 'outbox:go'` for the same reason.
  - `` expect(formatReport('985', result)).toContain('outbox:go — override in effect'); `` ("names
    the override when it waved the gate through") — **restored to this exact upstream text**
    (fix round 1; a first attempt had changed this to a generic `'override label in effect'` and
    dropped the label name from the printed line entirely — the controller ruled to keep the label
    name instead, via the new `overrideLabel` field). The hand-built result literal this test
    passes to `formatReport` now also carries `overrideLabel: 'outbox:go'` explicitly (it is not
    `gateResult`'s own output, so nothing sets that field for it otherwise).
- **Deleted**, per rule 6 ("A test case that reads the real upstream repository … is deleted and
  listed"): the whole `describe('the report also reaches $GITHUB_STEP_SUMMARY', ...)` block — both
  of its tests (`'is appended to the file at that path when the workflow sets it'` and `'is never
  touched when $GITHUB_STEP_SUMMARY is unset — a local run writes nothing new'`). Both drove the
  real CLI script directly (`execFileSync(process.execPath, [join(realRepoRoot,
  'scripts/outbox-status.mjs'), ...])`, importing `repoRoot as realRepoRoot` from
  `./check-utils.mjs`), which no longer exists in the kit (rule 3 — the CLI half is a later task's
  own work, and the `$GITHUB_STEP_SUMMARY`/`$GITHUB_OUTPUT` behavior it tests lived entirely in the
  deleted `main`). Their supporting imports (`execFileSync`, `readFileSync`, `realRepoRoot`) are
  dropped from the top of the file along with them.
- **Added, per the task's own Step 4** (not required by the mapping table's assertion-preserving
  rule, since it is brand-new behavior upstream has no equivalent of): `describe('gateResult —
  unreworked drift (this task)', ...)`, the task brief's own three cases verbatim (a `drifted`
  helper building one `settled.md` entry via `makeMarkers`, then: red while unreworked even with
  nothing open; green once the entry is closed by a rework; the override label still waves
  everything through). TDD RED confirmed: ran `npx vitest run kit/lib/outbox/status.test.mjs -t
  "this task"` before `unreworkedDrift`/the `gateResult` formula/`formatReport`'s new line
  existed — 1 failed ("stays red while a drifted entry is not reworked…", `expected true to be
  false`), 2 passed trivially (the other two already held with no drift logic at all, since
  `gateResult` was already green with no open item and no `changes` argument). GREEN confirmed
  after implementing: same file, full run, 26/26.

## Gate

`pnpm vitest run kit/lib/outbox/status.test.mjs kit/lib/outbox/settle-head.test.mjs
kit/test/no-literals.test.mjs` — 32/32 pass (26 in `status.test.mjs`, 5 in
`settle-head.test.mjs`, 1 in `no-literals.test.mjs`). Full `pnpm test` — 463/463 pass.
