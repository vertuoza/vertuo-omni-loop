# `kit/lib/outbox/settle.mjs`

Source: `scripts/outbox-settle.mjs` @ `vertuo-ai-domain@c4a210122`.

## Mapping applied

- Shebang line (`#!/usr/bin/env node`): deleted. The module has no executable CLI half any more
  (rule 3), so it is a plain lib module, like every other ported `kit/lib` file.
- `import { OUTBOX_DIR, SETTLED_FILE, parseOutboxItem, repoRoot } from './outbox.mjs'` →
  `import { SETTLED_FILE, parseOutboxItem } from './outbox.mjs'`. `OUTBOX_DIR` and `repoRoot` no
  longer exist on `outbox.mjs` (removed in its own port, Task 5) — every place that used either is
  rewritten below. Added `import { COMMANDS } from '../commands.mjs'` for the `/omni-yolo-fix`
  literal, and dropped the now-unused `fileURLToPath` (`node:url`) import (only the deleted CLI
  half used it).
- `ENTRY_OPEN(id)` / `ENTRY_CLOSE(id)` / `ENTRY_OPEN_RE` module constants (hardcoding the
  `vertuo-outbox` prefix): deleted. Every caller now takes an injected `markers` object
  (`kit/lib/markers.mjs`'s `makeMarkers(prefix)`) and calls `markers.settledOpen(id)` /
  `markers.settledClose(id)` / matches `markers.settledOpenRe` instead:
  - `renderSettledEntry({ item, itemText, answer, judgement })` →
    `renderSettledEntry({ item, itemText, answer, judgement, markers })`.
  - `rawSettledEntries(text)` → `rawSettledEntries(text, markers)`.
  - `parseSettledEntries(text)` → `parseSettledEntries(text, markers)`.
- `(/vertuo-yolo-fix)` in `closedLine`'s drifted `Closed:` text → `` `(${COMMANDS.yoloFix})` ``,
  i.e. `(/omni-yolo-fix)`.
- `` `docs/outbox/SETTLING.md` `` in `settledHeader`'s body text → the module took a second
  parameter, `settledHeader(prd, { ctx })`, and the line now reads
  `` `and the verdict. Nothing here is ever rewritten — see \`${ctx.layout.dirs.outbox}/README.md\`.` ``.
  Both call sites (`settleItem`, `adoptItem`) pass `{ ctx }` through.
- `settleItem({ root = repoRoot, file, answer })` → `settleItem({ ctx, file, answer })`; every
  `root` read inside becomes `ctx.root`.
  - `join(dirname(relativeFile), 'settled.md')` (settled.md sits next to whatever directory the
    open item file happened to live in) → `` `${outboxDir}/${SETTLED_FILE}` `` where
    `outboxDir = ctx.layout.outboxDir(item.prd)`, computed right after the item parses (so
    `item.prd` is known) and before the judgement runs. **New behaviour, per the task's own
    clarification**: `if (outboxDir === null) throw new Error(\`PRD ${item.prd} has no inbox or
    shipped folder\`);` — a real `throw`, not a returned `{ ok: false, errors }`, since this is not
    a validation failure of the *input* (the answer or the item file) but a structural fact about
    the repository the caller must fix. Placed before any `writeFileSync`/`rmSync`, so the
    all-or-nothing rule (nothing written unless every step holds) still holds.
  - `renderSettledEntry({ item, itemText, answer: parsedAnswer.data, judgement })` →  same call
    plus `markers: ctx.markers`.
- `adoptItem({ root = repoRoot, itemText })` → `adoptItem({ ctx, itemText })`.
  - `join(OUTBOX_DIR, String(item.prd), SETTLED_FILE)` (the task's own mapping-table row) →
    `` `${outboxDir}/${SETTLED_FILE}` `` where `outboxDir = ctx.layout.outboxDir(item.prd)`,
    with the **same** `outboxDir === null` throw as `settleItem`, for the same reason: `OUTBOX_DIR`
    doesn't exist any more, and there is no other way left in this module to decide where a PRD's
    ledger lives. Not explicitly asked for `adoptItem` by the task's clarification (which names only
    `settleItem`), but required by the mapping-table row itself, and kept symmetric with
    `settleItem` on purpose — one rule, one message, one place either function can fail to resolve
    a PRD's outbox directory. Covered by an added test (see below).
  - `renderAdoptedEntry({ item, itemText })` → `renderAdoptedEntry({ item, itemText, markers: ctx.markers })`.
- `renderAdoptedEntry({ item, itemText })` → `renderAdoptedEntry({ item, itemText, markers })`,
  forwarding `markers` into its own `renderSettledEntry` call.
- **`became` (Step 3 of the task).** In `rawSettledEntries`, right after `closed` is computed:
  `const became = (current.fields.Became ?? '').split(',').map((id) => id.trim()).filter(Boolean);`
  — added to the entry object returned by `parseSettledEntries`. `renderSettledEntry` itself never
  *writes* a `Became:` field (nothing in this slice produces one yet — that is a later slice's
  job); this only teaches the reader to parse one when it is there, and to report `[]` when it
  isn't.
- **No CLI half** (rule 3): `USAGE`, `parseArgv`, `main`, and
  `if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2));` all
  deleted. Task 15 rebuilds the CLI.
- Module doc comment: the one sentence naming `docs/outbox/SETTLING.md` directly is reworded to
  point at "the outbox dir's own `README.md` (rendered by {@link settledHeader})" instead, since
  the literal path doesn't exist in the kit. `adoptItem`'s own doc comment similarly no longer
  names `docs/outbox/<prd>/settled.md` or `outbox-policy.mjs` (neither exists in the kit); both are
  reworded in terms of "the item's PRD's outbox directory" and "an outbox item renderer's output".
  The `parseSettledEntries` doc comment's references to this file's own (now-deleted) CLI and to
  `outbox-comment.mjs`/`rework.mjs` (neither ported yet) are generalized to "this module's own
  callers" / "an outbox comment's Answered section" / "a rework step's drifted-entry search".
- Every other export (`VERDICTS`, `ADOPTED_VERDICT`, `CHANNEL_KINDS`, `AnswerSchema`,
  `channelLabel`, `judgeAnswer`, `fenceFor`, `verbatimBlock`, `closedLine`'s non-drifted branches,
  `latestPerId`, `locate`, `adoptedJudgement`) is unchanged — none of them read `root`, a marker
  literal, or `/vertuo-yolo-fix`.

## Test (`settle.test.mjs`)

- Import path `./outbox-settle.mjs` → `./settle.mjs`.
- Added imports: `makeMarkers` (`kit/lib/markers.mjs`), `makeRepo` (`kit/test/fixture.mjs`),
  `flatCtx` (`kit/test/flat-layout.mjs`). Removed `execFileSync` (`node:child_process`) and
  `import { repoRoot as realRepoRoot } from './check-utils.mjs'` — both were only used by the
  deleted CLI test (see below).
- Added a module-scope `const markers = makeMarkers('vertuo-outbox');`, matching `flatCtx`'s own
  configured prefix, per the task's own clarification ("markers = makeMarkers('vertuo-outbox')").
  Used by every direct call to `parseSettledEntries`, `renderSettledEntry`, `renderAdoptedEntry`.
- Every `settleItem({ root, ... })` / `adoptItem({ root, ... })` call → `settleItem({ ctx:
  flatCtx(root), ... })` / `adoptItem({ ctx: flatCtx(root), ... })`. The `settle()` test helper
  does this once; every other direct call site (in "what settling refuses", "settled.md as a
  ledger", "a medium item is adopted…", "the ledger's readers…", "renderAdoptedEntry…") was updated
  the same way. `root` itself (the raw temp directory, for `existsSync`/`readFileSync` assertions)
  is untouched — `flatCtx(root)` is a pure wrapper, called fresh at each site rather than stored.
- Every `parseSettledEntries(text)` call → `parseSettledEntries(text, markers)`.
- Every `renderSettledEntry({...})` / `renderAdoptedEntry({...})` call → same call plus `markers`.
- **Changed assertions** (both pre-authorized by the task's own clarification; neither actually
  fires in the ported suite as inherited, because upstream's own test never asserted either literal
  in an `expect(...)` — only named `/vertuo-yolo-fix` once, in a comment, not a check):
  - The comment `// An objection appends a \`drifted\` entry for the SAME id, exactly as
    \`/vertuo-yolo-fix\` will do once slice s6 wires the reply that reads it` → reworded to
    `/omni-yolo-fix` and "once a later slice wires the reply that reads it" (no upstream slice
    numbering exists in the kit). Not a functional assertion change — no `expect(...)` in the
    upstream file names either the yolo-fix command or `SETTLING.md`/the header text at all — but
    listed here since the task named it explicitly as an allowed change.
  - `settledHeader`'s `SETTLING.md` → `README.md` literal: no test assertion needed changing for
    the same reason (nothing in the ported suite reads the header past its first line — see
    `'starts the file with a header, and a second settling appends under it'`, which only checks
    `settled.split('\n')[0]`).
- **Deleted** (Port Protocol rule 6 — the test's own CLI half no longer exists to run):
  `it('is exposed on the command line, adopting from a plain text file with no open item
  involved', …)` — `execFileSync`'d `join(realRepoRoot, 'scripts/outbox-settle.mjs')` directly.
  There is no CLI left in this module (rule 3); Task 15 rebuilds it, and its own test suite is
  where a CLI test for `adopt` belongs.
- **Added**, per Task 6's own steps:
  - Step 3's exact test (`'reads Became: as a list of ids'`, using a locally-scoped
    `makeMarkers('omni-outbox')`, not the module-scope `vertuo-outbox` one — matches the task's own
    snippet verbatim), plus one more (`'is an empty list when the entry carries no Became: field'`)
    proving the field defaults to `[]` rather than `undefined` on an ordinary settled entry. Both
    live in a new `describe('Became: is parsed as a list of ids', …)`.
  - Step 5's folders-layout case (`describe('settleItem against the folders layout', …)`): builds
    `FOLDERS_ITEM_TEXT` from the module's own `ITEM_TEXT` fixture (a valid, already-ported item) by
    swapping `id`/`prd`/`slice` to `s1-01-x` / `42` / `s1`; seeds
    `.omni-loop/delivery/inbox/0042-a/spec.md` and
    `.omni-loop/delivery/outbox/0042-a/s1-01-x.md` through `makeRepo` (default marker prefix
    `omni-outbox`); asserts `settleItem` returns `ok: true`, `settledFile ===
    '.omni-loop/delivery/outbox/0042-a/settled.md'`, the returned `entry` starts with
    `<!-- omni-outbox-settled: s1-01-x -->`, the open item file is gone, and `settled.md` on disk
    contains both the marker and the item's full original text.
  - Two more tests in the same `describe`, exercising the new `outboxDir === null` throw added to
    both `settleItem` and `adoptItem` (not required by the task brief in so many words, but the
    mapping-table row and the task's own clarification both describe the behaviour, so it is
    tested): `settleItem` throws `Error('PRD 999 has no inbox or shipped folder')` for an item
    whose `prd` matches no inbox/shipped folder, and leaves the stray item file untouched;
    `adoptItem` throws the same message for a `medium` item under the same condition.
- TDD evidence:
  - **Became:** RED — temporarily removed the `became` computation and field from
    `rawSettledEntries`; `npx vitest run kit/lib/outbox/settle.test.mjs -t Became` failed both new
    tests (`expected [...] to deeply equal [...]` / `expected undefined to deeply equal []`).
    GREEN — restored; same command, both pass; full file re-run afterwards, 41/41.
  - **Folders layout:** RED — temporarily reverted `settleItem`'s settled-file path back to
    `dirname(relativeFile)` (no `outboxDir`, no throw); `npx vitest run kit/lib/outbox/settle.test.mjs
    -t "folders layout"` failed the new `outboxDir === null` throw test (`ENOENT: no such file or
    directory, open '.../stray-item.m/settled.md'` — proving the old path-derivation reads a
    directory name off the file path itself rather than resolving the PRD, and blows up instead of
    refusing cleanly). The other two folders-layout tests still passed under the reverted code,
    since `dirname(relativeFile)` and `ctx.layout.outboxDir(item.prd)` happen to agree when the
    item file already sits inside its own PRD's outbox directory — exactly why the dedicated throw
    test is the one that proves the new resolution, not the happy-path test. GREEN — restored;
    same command, all 3 pass; full file re-run afterwards, 41/41.

## Gate

`pnpm vitest run kit/lib/outbox/settle.test.mjs kit/test/no-literals.test.mjs` — 42/42 pass.

## Final review fixes

- `settledHeader` points at `<ctx.config.paths.delivery>/README.md` (the delivery folder's README,
  which exists) instead of `<dirs.outbox>/README.md` (which the folders layout never creates).
  Test: "settledHeader (final review) › points at the delivery folder's README".
