# `kit/lib/policy/rework.mjs`

Source: `.claude/skills/vertuo-yolo-fix/rework.mjs` @ `vertuo-ai-domain@c4a210122`.

## Mapping applied

- `import { parseSettledEntries } from '../../../scripts/outbox-settle.mjs'` → `import {
  parseSettledEntries } from '../outbox/settle.mjs'` (Task 6's own location; signature grew to
  `parseSettledEntries(text, markers)`).
- `import { parseOutboxItem } from '../../../scripts/outbox.mjs'` → `import { parseOutboxItem }
  from '../outbox/outbox.mjs'` (Task 5's own location; unchanged signature).
- `import { parsePlanSlices, sharedGround } from '../../../scripts/check-territory.mjs'` → `import
  { parsePlanSlices, sharedGround } from '../inbox/territory.mjs'` (Task 12's own rename;
  unchanged signatures).
- `` `<!-- vertuo-outbox-settled: ${id} -->` ``/`` `<!-- /vertuo-outbox-settled: ${id} -->` `` (the
  module-level `CLOSED_FIELD`/open/close marker literals): replaced by `markers`, per the task's
  own mapping table row (`` `<!-- vertuo-outbox-settled: … -->` in rework | `markers` ``):
  - `driftedEntries(settledText)` → `driftedEntries(settledText, markers)`; body
    `parseSettledEntries(settledText ?? '')` → `parseSettledEntries(settledText ?? '', markers)`.
  - `planRework({ settledText, planMarkdown, prd, featureBranch })` → gained a required `markers`
    field, threaded into both `parseSettledEntries` and `driftedEntries`.
  - `closeDriftedEntry(settledText, { id, pullRequest })` → gained a required `markers` field in
    its options object; body `parseSettledEntries(settledText)` → `parseSettledEntries(settledText,
    markers)`; the two module-level literal markers (`` `<!-- vertuo-outbox-settled: ${id} -->` ``,
    `` `<!-- /vertuo-outbox-settled: ${id} -->` ``) → `markers.settledOpen(id)` /
    `markers.settledClose(id)`; `` `${CLOSED_FIELD}yes — reworked by …` `` (`CLOSED_FIELD =
    '- Closed: '`) → the literal `'- Closed: '` prefix inlined directly (the constant carried no
    other meaning once `markers` replaced the open/close lines, so it was dropped rather than kept
    as a single-use alias).
- `/vertuo-yolo-fix` (two prose mentions: the module doc's opening line, and `renderReworkPlan`'s
  "Derived by `/vertuo-yolo-fix` from…" line; and the `closeDriftedEntry` refusal message "…and
  /vertuo-yolo-fix re-decides nothing") → `/omni-yolo-fix` (`COMMANDS.yoloFix`'s own literal value,
  `kit/lib/commands.mjs`) throughout — inlined as the literal string rather than importing
  `COMMANDS`, since nothing else in this module needs the `COMMANDS` object and the task's own
  mapping table names only the command literals, not a new import.
- `namedPaths`, `chosenOptionOf`, `reworkSliceId`, `deriveRework`, `assignWaves`, `reportLines`,
  `reworkPullRequest`: bodies unchanged — none of them reads a marker, a root, or a repository
  literal.
- Module doc comment: reworded to drop `docs/outbox/SETTLING.md` and every `vertuo`-prefixed
  literal (`/vertuo-yolo-fix`, `<!-- vertuo-outbox-settled: … -->`) in favour of "nothing closes
  that but a rework", "the settled ledger" and generic prose about `markers`.
- No CLI half to remove: `.claude/skills/vertuo-yolo-fix/rework.mjs` never had a
  `process.argv[1] === fileURLToPath(...)` block, so rule 3 applies vacuously.

## Test (`rework.test.mjs`)

- Added imports: `flatCtx` (`kit/test/flat-layout.mjs`); `parsePlanSlices` from
  `../inbox/territory.mjs` (was `../../../scripts/check-territory.mjs`); `appendObjection` from
  `../outbox/replies.mjs` (was `../../../scripts/outbox-replies.mjs` — Task 11 ported it there,
  not `comment.mjs`, so the import path is `replies.mjs`, not what the task brief's own mapping
  table row implies by naming `comment.mjs`/`registers.mjs`); `adoptItem`, `parseSettledEntries`,
  `settleItem` from `../outbox/settle.mjs`; `parseOutboxItem` from `../outbox/outbox.mjs`.
- Added a module-level `MARKERS = flatCtx('/virtual-repo').markers` constant — `flatCtx`'s markers
  never depend on `root` (always the `vertuo-outbox` prefix, per the task's own instruction to use
  `makeMarkers('vertuo-outbox')`/`flatCtx`), so a placeholder root is enough to derive them without
  an extra fixture directory.
- `settledLedger(settlings)`: gained `const ctx = flatCtx(root);` right after `mkdtempSync`;
  `settleItem({ root, file, answer })` → `settleItem({ ctx, file, answer })`.
- Every `driftedEntries(settledLedger(…))` call → `driftedEntries(settledLedger(…), MARKERS)`.
- Every `planRework({ settledText, planMarkdown, prd, featureBranch })` call → gained `markers:
  MARKERS`.
- Every `closeDriftedEntry(settledText, { id, pullRequest })` call → gained `markers: MARKERS` in
  the options object.
- Every `parseSettledEntries(closed)` / `parseSettledEntries(settled)` call → `parseSettledEntries
  (closed, MARKERS)` / `parseSettledEntries(settled, markers)` (the latter inside
  `adoptedThenObjected`, which returns its own `ctx.markers` alongside the settled text, since that
  helper builds its own `ctx` from a fresh `root`).
- `adoptedThenObjected({ because })`: `const root = mkdtempSync(...)` gained `const ctx =
  flatCtx(root);` right after it; `adoptItem({ root, itemText: OPTIONED_ITEM_TEXT })` → `adoptItem
  ({ ctx, itemText: OPTIONED_ITEM_TEXT })`; `parseSettledEntries(readFileSync(ledger, 'utf8'))` →
  `parseSettledEntries(readFileSync(ledger, 'utf8'), ctx.markers)`; `appendObjection({ root, prd,
  adoptedEntry, item, answer, judgement })` → `appendObjection({ ctx, prd, adoptedEntry, item,
  answer, judgement })`. The helper's own return value changed from a bare settled-text string to
  `{ settledText, markers: ctx.markers }`, since its two call sites both now need the markers
  alongside the text (Port Protocol rule 6 covers threading a grown signature; this is the same
  idea one level up, in a test-only helper).
- `PLAN`'s `s9` row: `` `.claude/skills/vertuo-yolo-fix/` `` (a territory declaration in the
  fixture markdown table, not a real path any kit module reads) → `` `kit/lib/policy/rework.mjs` ``
  — kept as a plausible-looking territory string for the "runs two reworks that share no ground"
  case, which also renames the matching `## What it costs to change later` bound text from `` `.
  claude/skills/vertuo-yolo-fix/rework.mjs` `` to `` `kit/lib/policy/rework.mjs` `` for the same
  reason (both are fixture data, not code the kit resolves against).
- Every other fixture literal (`libs/vertuo-domain-contact/…`, `libs/vertuo-domain-quote/…`,
  `libs/system-api-contract/…`, `scripts/outbox-settle*`, `docs/outbox/SETTLING.md`,
  `pierrederval`): **unchanged** — these are fixture *content* (territory declarations, item
  bodies) the test asserts against verbatim, not literals this task's own mapping table names, and
  test files are exempt from `kit/test/no-literals.test.mjs`'s scan.
- **Deleted:** nothing. Every upstream test case is ported; none reads the real upstream
  repository, so Port Protocol rule 6's deletion clause never applies here.

## Gate

`pnpm vitest run kit/lib/policy/rework.test.mjs kit/test/no-literals.test.mjs` — 26/26 pass (25 in
`rework.test.mjs`, 1 in `no-literals.test.mjs`).
