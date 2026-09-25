# `kit/lib/outbox/replies.mjs`

Source: `scripts/outbox-replies.mjs` @ `vertuo-ai-domain@c4a210122`.

## Mapping applied

- Shebang line (`#!/usr/bin/env node`): deleted — a plain lib module, like every other ported
  `kit/lib` file (rule 3).
- `import { existsSync, readFileSync, writeFileSync } from 'node:fs'` kept (still needed by
  `appendObjection` and the local `adoptedEntriesForPrd`); `import { join } from 'node:path'` kept
  (still needed to build `appendObjection`'s absolute settled-file path); dropped
  `import { fileURLToPath } from 'node:url'` (only the deleted CLI half used it).
- **`outbox-comment.mjs` is not ported yet** (no task before this one ports it), but
  `outbox-replies.mjs` imports six of its functions: `adoptedEntriesForPrd`, `findPrMarkerComment`,
  `ghClient`, `openItemsForPrd`, `parseNumbersMarker`, `parseRoundMarkers`. Per the task's own
  clarification ("If upstream's CLI half constructs a real client, delete it with the CLI half"),
  `ghClient` is deleted outright — it is CLI-only, and Task 15 rebuilds it. The other five are
  reimplemented as **private, non-exported** helpers inside this module (the task's own "Produces"
  list does not name any of them, confirming they are internal, not new public surface):
  - `findPrMarkerComment(comments, markers)` — same "found by content, not by position" search, but
    matches `markers.prComment` instead of the hard-coded `PR_MARKER` constant.
  - `parseNumbersMarker(body, markers)` — same round-trip parse, but matches `markers.numbersRe`
    instead of the hard-coded `NUMBERS_MARKER_RE`.
  - `parseRoundMarkers(comments, markers)` — same "latest round per number" reduction, but matches
    `markers.roundRe` instead of the hard-coded `ROUND_MARKER_RE`.
  - `openItemsForPrd(prd, { ctx })` — same "filter `outboxItemFiles` to one PRD's own directory,
    parse each, skip a malformed one" logic, but the directory prefix is
    `` `${ctx.layout.outboxDir(prd)}/` `` (returning `[]` when `outboxDir` is `null`, i.e. no
    inbox/shipped folder for that PRD) instead of the hard-coded `` `docs/outbox/${prd}/` ``, and
    reads each file through `readRepoFile(ctx, file)` (`check-report.mjs`) instead of
    `readFileSync(join(root, file), 'utf8')`.
  - `adoptedEntriesForPrd(prd, { ctx })` — same "settled entries whose latest verdict is `adopted`"
    filter, but resolves the ledger path via `` `${ctx.layout.outboxDir(prd)}/${SETTLED_FILE}` ``
    (returning `[]` when `outboxDir` is `null`) and reads it with `readRepoFile`/`existsSync`
    against `ctx.root`, mirroring `status.mjs`'s own `unreworkedDrift`. Calls `parseSettledEntries`
    with `ctx.markers` (that function's signature already grew a `markers` parameter in Task 6's
    port of `settle.mjs`).
- `OUTBOX_MARKER_PREFIX = '<!-- vertuo-outbox'` module constant: deleted. Every use rewritten to the
  injected `markers.any` (the task's own mapping-table row): `isCountedReply(comment)` →
  `isCountedReply(comment, markers)`.
- The round marker literal in `formatRoundComment`
  (`` `<!-- vertuo-outbox-round: ${round} ${numbers.join(',')} -->` ``) → `markers.round(round,
  numbers)` (the task's own mapping-table row); `formatRoundComment({ round, questions })` →
  `formatRoundComment({ round, questions, markers })`.
- `DEFAULT_REPO = 'vertuoza/vertuo-ai-domain'`: deleted (the task's own mapping-table row) — it was
  only read by the deleted CLI half (`repo ?? DEFAULT_REPO`); the CLI's replacement (Task 15) reads
  `ctx.config.repo.slug` instead.
- `appendObjection({ root = repoRoot, prd, adoptedEntry, item, answer, judgement })` →
  `appendObjection({ ctx, prd, adoptedEntry, item, answer, judgement })` (rule 4).
  - `join(OUTBOX_DIR, String(prd), SETTLED_FILE)` → `` `${ctx.layout.outboxDir(prd)}/${SETTLED_FILE}` ``
    (the task's own mapping-table row); `join(root, settledFile)` → `join(ctx.root, settledFile)`.
  - `renderSettledEntry({ item, itemText, answer, judgement })` → same call plus
    `markers: ctx.markers` — required because `renderSettledEntry`'s own signature already grew a
    `markers` parameter in Task 6's port of `settle.mjs`; not itself a row in this task's mapping
    table, but a direct consequence of importing the already-ported `settle.mjs`.
- `readReplies({ prd, pr, root = repoRoot, post = false }, client)` →
  `readReplies({ ctx, prd, pr, post = false }, client)` (rule 4).
  - `openItemsForPrd(prd, { root })` → `openItemsForPrd(prd, { ctx })` (this module's own local
    helper, above).
  - `adoptedEntriesForPrd(prd, { root })` → `adoptedEntriesForPrd(prd, { ctx })` (ditto).
  - `planReplies({ comments, items, adopted })` → `planReplies({ comments, items, adopted, markers:
    ctx.markers })` (the task's own interface row: `planReplies` takes `markers`).
  - `settleItem({ root, file: item.file, answer: given })` → `settleItem({ ctx, file: item.file,
    answer: given })` (`settle.mjs`'s own already-ported signature, Task 6).
  - `appendObjection({ root, prd, adoptedEntry, item, answer: given, judgement })` →
    `appendObjection({ ctx, prd, adoptedEntry, item, answer: given, judgement })`.
  - `formatRoundComment({ round: plan.round.number, questions: plan.round.questions })` → same call
    plus `markers: ctx.markers`.
- `planReplies({ comments, items, adopted = [] })` → `planReplies({ comments, items, adopted = [],
  markers })` (the task's own interface row). Every internal call site threaded `markers` through:
  `findPrMarkerComment(all, markers)`, `parseNumbersMarker(prComment.body, markers)`,
  `all.filter(isCountedReply)` → `all.filter((comment) => isCountedReply(comment, markers))`,
  `lastReaskedAt(all)` → `lastReaskedAt(all, markers)` (which itself now takes `markers` and forwards
  it to `parseRoundMarkers([comment], markers)`).
- `isCountedReply(comment)` → `isCountedReply(comment, markers)` (the task's own interface row).
- **No CLI half** (rule 3): `USAGE`, the whole
  `if (process.argv[1] === fileURLToPath(import.meta.url)) { … }` block (argv parsing, `ghClient`
  call, `console.log`/`process.exit`) all deleted. Task 15 rebuilds the CLI.
- **Comments naming a `vertuo-…` literal** (caught by `no-literals.test.mjs`'s `/vertuo/i` scan,
  which checks every line including doc comments, not just runtime string literals):
  - Module doc comment, point 1: `` carry **no** `<!-- vertuo-outbox` marker `` → reworded to
    `` carry **no** outbox marker (the configured marker prefix, `markers.any`) ``.
  - Module doc comment and `interpretAnswer`'s own doc comment, each naming `` `/vertuo-yolo-fix` ``
    (the task's own mapping-table row: `/vertuo-yolo-fix` → `COMMANDS.yoloFix`) → both reworded to
    the plain literal `` `/omni-yolo-fix` ``. Neither occurrence is executable code — both sit
    inside JSDoc prose naming which command a rework author would run next — so there is no
    `COMMANDS.yoloFix` expression to interpolate into a comment; the configured kit command name is
    written out directly instead, exactly as `settle.mjs`'s own porting record did for its one
    prose mention of the same command.
  - Module doc comment's closing paragraph, which named `outbox-comment.mjs`'s exact
    `listComments`/`createComment`/`updateComment` seam and `outbox-comment.mjs`'s `ghClient` by
    path: reworded to describe the same seam and the "no network, never shells out to `gh`" stance
    without naming the (not-yet-ported) upstream file.
  - Every other reference to `PRD #1071`/`PRD #1166` slice numbering is upstream's own plan
    provenance, not a repository literal, and is unchanged.
- Every other export (`WRITER_ASSOCIATIONS`, `APPROVE_ALL_TEXT`, `RECOMMENDATION_TEXT`,
  `parseReplyLines`, `interpretAnswer`, `answerableQuestions`, `time`, `chronological`, `summarize`)
  is unchanged — none of them read `root`, a marker literal, or `/vertuo-yolo-fix`.

## Test (`replies.test.mjs`)

- Import path `./outbox-replies.mjs` → `./replies.mjs`.
- Added imports: `flatCtx` (`kit/test/flat-layout.mjs`), `makeMarkers` (`kit/lib/markers.mjs`).
  Removed `import { formatNumbersMarker, PR_MARKER } from './outbox-comment.mjs';` — that module is
  not ported yet, and even once it is, this test's fixtures must not depend on it, since
  `outbox-comment.mjs` is a *different* module's port, not this task's.
- Added a module-scope `const markers = makeMarkers('vertuo-outbox');`, matching `flatCtx`'s own
  configured prefix, per the task's own clarification ("markers should reproduce it, since flatCtx
  uses the `vertuo-outbox` prefix"). Used to build every fixture marker (`prComment`, `roundComment`,
  the "carries an outbox marker" test) and passed to every `planReplies`/`formatRoundComment` call
  that now requires it, and to `parseSettledEntries` in `settledOf`.
- Added a small test-only `formatNumbersMarkerFixture(numbering)` — the same round-trip algorithm
  upstream's own (not-yet-ported) `formatNumbersMarker` uses, rebuilt locally against `markers`
  instead of imported, since the real one does not exist in the kit yet. It is fixture-construction
  code (builds the pull request comment body the test hands to `readReplies`), not a function under
  test, so this is not a Port Protocol rule-6 assertion change.
- `prComment(numbering, { id })`: `PR_MARKER` → `markers.prComment`; `formatNumbersMarker(numbering)`
  → `formatNumbersMarkerFixture(numbering)`.
- `roundComment(round, numbers, { at })`: the hard-coded
  `` `<!-- vertuo-outbox-round: ${round} ${numbers.join(',')} -->` `` → `` `${markers.round(round,
  numbers)}` ``.
- The "ignores a writer comment that carries an outbox marker" test's inline
  `` `<!-- vertuo-outbox-round: 2 1 -->\n1: ok\napprove all` `` → `` `${markers.round(2,
  [1])}\n1: ok\napprove all` ``.
- Every `readReplies({ prd, pr, root, ... }, client)` call → `readReplies({ ctx: flatCtx(root), prd,
  pr, ... }, client)`, `flatCtx(root)` built fresh at each call site (same convention
  `settle.test.mjs` and `status.test.mjs` already use) — `root` itself (the raw temp directory, for
  `existsSync`/`readFileSync`/`writeItem`/`writeOptioned` assertions and setup) is untouched.
- Every `planReplies({ comments, items })` / `planReplies({ comments, items, adopted })` call →
  same call plus `markers` (the task's own interface row).
- Every `formatRoundComment({ round, questions })` call → same call plus `markers`.
- `adopt(root, id, spec)`: `adoptItem({ root, itemText })` → `adoptItem({ ctx: flatCtx(root),
  itemText })` (`settle.mjs`'s own already-ported signature, Task 6).
- `settledOf(root)`: `parseSettledEntries(readFileSync(file, 'utf8'))` →
  `parseSettledEntries(readFileSync(file, 'utf8'), markers)` (`settle.mjs`'s own already-ported
  signature, Task 6).
- **Assertion changes: none.** Every `expect(...)` in the ported suite is byte-identical to
  upstream's. Every marker literal an assertion checks (`'<!-- vertuo-outbox-round: 2 1 -->'`,
  `'<!-- vertuo-outbox-round: 4 1 -->'`, `'<!-- vertuo-outbox-round: 3 2,4 -->'`, the
  `^<!-- vertuo-outbox-settled: /gm` pattern in `rawEntryCount`) reproduces exactly, because
  `flatCtx`'s configured marker prefix (`vertuo-outbox`) is byte-identical to upstream's own
  hard-coded prefix — the clarification's own prediction ("it should reproduce it") held for every
  case; the `/omni-yolo-fix` rewording named in the clarification never actually appears in this
  test file (only in the module's own doc comments — see above), so there was nothing to change
  there either.
- **Deleted: none.** Upstream's test file (`outbox-replies.test.mjs`) carries no CLI-invoking test
  (no `execFileSync`, no `realRepoRoot`) to delete under rule 6.

## Gate

`pnpm vitest run kit/lib/outbox/replies.test.mjs kit/test/no-literals.test.mjs` — 44/44 pass.
`pnpm test` — 506/506 pass (31 files).

## Superseded by Task 11 (`kit/lib/outbox/comment.mjs`, `kit/porting/outbox--comment.md`)

Task 11 ported `scripts/outbox-comment.mjs` to `kit/lib/outbox/comment.mjs`, which now exports the
same five functions this module had reimplemented privately above (per that task's controller
ruling 3: "once comment.mjs exports these, delete replies.mjs's private copies and import them from
./comment.mjs"). Applied here:

- Deleted the private, non-exported `findPrMarkerComment(comments, markers)`,
  `parseNumbersMarker(body, markers)`, `parseRoundMarkers(comments, markers)`,
  `openItemsForPrd(prd, { ctx })` and `adoptedEntriesForPrd(prd, { ctx })` function bodies from
  `replies.mjs` — each was byte-identical in logic to `comment.mjs`'s own exported version (same
  regex, same "found by content" search, same null-guarded `outboxDir` prefix). `lastReaskedAt`
  (which called the local `parseRoundMarkers`) now calls the imported one instead; nothing else in
  its own body changed.
- Added `import { adoptedEntriesForPrd, findPrMarkerComment, openItemsForPrd, parseNumbersMarker,
  parseRoundMarkers } from './comment.mjs';` in their place.
- Dropped now-unused imports that only the deleted private copies needed: `ADOPTED_VERDICT` and
  `parseSettledEntries` from `./settle.mjs` (still imports `AnswerSchema`, `judgeAnswer`,
  `renderSettledEntry`, `settleItem`), and `outboxItemFiles` from `./outbox.mjs` (still imports
  `SETTLED_FILE` for `appendObjection`, and re-added `parseOutboxItem`, still needed by
  `answerableQuestions`); `readRepoFile` from `../check-report.mjs` is no longer imported at all
  (its only two call sites were inside the two deleted functions).
- **No import cycle**: `comment.mjs` does not import `replies.mjs`, directly or transitively (it
  imports `outbox.mjs`, `settle.mjs`, `status.mjs`, `check-decision-coverage.mjs`,
  `check-report.mjs`, `commands.mjs` — none of which import `replies.mjs` either).
- `replies.test.mjs`: added `import { formatNumbersMarker } from './comment.mjs';`; deleted the
  test-only `formatNumbersMarkerFixture(numbering)` helper (a hand-rebuilt copy of the round-trip
  algorithm, written only because `comment.mjs` did not exist yet) and its one call site
  (`prComment`'s body) now calls the real `formatNumbersMarker(numbering, markers)` instead.
  **Assertion changes: none** — the real function produces byte-identical output to the fixture
  copy it replaces (both build `` `${markers.numbersPrefix}<n>=<id>@<since>,… ${markers.
  numbersSuffix}` ``).

Gate after this change: `pnpm vitest run kit/lib/outbox/replies.test.mjs
kit/lib/outbox/comment.test.mjs kit/test/no-literals.test.mjs` — 164/164 pass. Full `pnpm test` —
626/626 pass (32 files).
