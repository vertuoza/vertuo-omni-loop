# `kit/lib/outbox/comment.mjs`

Source: `scripts/outbox-comment.mjs` @ `vertuo-ai-domain@c4a210122`.

## Mapping applied

- Shebang line (`#!/usr/bin/env node`): deleted — a plain lib module, like every other ported
  `kit/lib` file (rule 3).
- **No CLI half** (rule 3): `USAGE`, `DEFAULT_REPO`, and the whole
  `if (process.argv[1] === fileURLToPath(import.meta.url)) { … }` block (argv parsing, the
  production `ghClient` call, `console.log`/`process.exit`) are deleted, along with the imports only
  they used (`execFileSync`, `fileURLToPath`). Task 15 rebuilds the CLI.
- **`ghClient` deleted outright** (controller ruling 1) — it shells out to `gh`; `kit/lib` does no
  network I/O. `outbox-comment.test.mjs` carries no test that exercises `ghClient` directly (every
  test drives `upsertOutboxComment`/`upsertOutboxPrComment` against the fake `GhCommentClient`
  shape), so there is nothing to delete on the test side. Task 15 re-ports it into
  `kit/bin/github.mjs`.
- **`rangeChanges` deleted outright** (controller ruling 2) — it was already ported to
  `kit/lib/git.mjs` in Task 8 (`rangeChanges({ ctx, base, exec })`); this module never calls it (only
  the deleted CLI half did, via `base ? rangeChanges(base) : []`), so nothing imports it here.
- **`parseNameStatus` re-exported, not re-implemented** (controller ruling 2) — upstream's own
  `parseNameStatus` in this file is byte-identical in logic to `check-decision-coverage.mjs`'s
  already-ported `parseNameStatus` (same split/trim/filter/map over `git diff --name-status`
  lines). `outbox-comment.test.mjs` imports `parseNameStatus` from `./outbox-comment.mjs`, so the
  ported module re-exports it: `export { parseNameStatus } from './check-decision-coverage.mjs';`.
- **`unaccountedChanges` imported from `status.mjs`, not re-implemented** (controller ruling 2) —
  upstream's own `unaccountedChanges(prd, changes, { root })` in this file
  (`riskyChanges(changes, {root})` graded against `readAccounts(prd, {root})`'s `ok` results via
  `compare`) is byte-identical in logic to `status.mjs`'s already-ported
  `unaccountedChanges(prd, changes, { ctx })`. Imported and re-exported:
  `import { unaccountedChanges } from './status.mjs'; export { unaccountedChanges };` — the test
  file imports it from `./outbox-comment.mjs`, so it is re-exported the same way.
- `MARKER = '<!-- vertuo-outbox -->'`, `PR_MARKER = '<!-- vertuo-outbox-pr -->'` (module constants):
  deleted, per the task's own mapping table (`MARKER, PR_MARKER` → `markers.comment,
  markers.prComment`). No longer exported — the task's own exact-exports list does not name them.
  Every read site now takes an injected `markers` (or, for the two formatters, the full `ctx`) and
  reads `ctx.markers.comment` / `ctx.markers.prComment` instead:
  - `findMarkerComment(comments)` → `findMarkerComment(comments, markers)`.
  - `findPrMarkerComment(comments)` → `findPrMarkerComment(comments, markers)` (see below — this
    export was missing from the brief's own "Produces" list, but the controller's rulings for
    `kit/lib/outbox/replies.mjs` name it as one of the five functions that module must import back
    from this one once it exists, so it is exported here with the same `(comments, markers)` shape
    as `findMarkerComment`).
  - `formatOutboxComment({ …, ctx })`: `lines = [MARKER, …]` → `lines = [ctx.markers.comment, …]`.
  - `formatOutboxPrComment({ …, ctx })`: `lines = [PR_MARKER, …]` → `lines = [ctx.markers.prComment,
    …]`.
- `ANNOUNCED_MARKER_PREFIX`, `ANNOUNCED_MARKER_SUFFIX`, `ANNOUNCED_MARKER_RE` (module constants,
  the first exported): deleted — these are exactly `markers.announcedPrefix`,
  `markers.announcedSuffix`, `markers.announcedRe` (`kit/lib/markers.mjs`, already built from the
  same `<!-- ${prefix}-announced: … -->` shape). `formatAnnouncedMarker(keys)` →
  `formatAnnouncedMarker(keys, markers)`; `parseAnnouncedMarker(body)` → `parseAnnouncedMarker(body,
  markers)` (the task's own interface row).
- `NUMBERS_MARKER_PREFIX`, `NUMBERS_MARKER_SUFFIX`, `NUMBERS_MARKER_RE` (module constants, the
  first exported): deleted — exactly `markers.numbersPrefix`, `markers.numbersSuffix`,
  `markers.numbersRe`. `formatNumbersMarker(numbering)` → `formatNumbersMarker(numbering, markers)`;
  `parseNumbersMarker(body)` → `parseNumbersMarker(body, markers)` (the task's own interface row).
- `ROUND_MARKER_RE` (module constant): deleted — exactly `markers.roundRe`. `parseRoundMarkers
  (comments)` → `parseRoundMarkers(comments, markers)` (the task's own interface row).
- `` `docs/outbox/${prd}/` `` (in `openItemsForPrd`'s prefix) → `` `${ctx.layout.outboxDir(prd)}/`
  `` (the task's own mapping-table row). **New null guard added**, mirroring `status.mjs`'s
  `openItemFiles` and `replies.mjs`'s own local copy: `ctx.layout.outboxDir(prd)` can return `null`
  (a PRD with no inbox or shipped folder), which the hard-coded upstream string never could —
  `openItemsForPrd` returns `[]` in that case.
- `` `docs/outbox/${prd}/settled.md` `` (in `formatOutboxComment`'s "Settled items move to …" line) →
  `` `${ctx.layout.outboxDir(prd)}/settled.md` `` (the task's own mapping-table row).
- `` join(OUTBOX_DIR, String(prd), SETTLED_FILE) `` (in the private `readSettledEntries`) →
  `` `${outboxDir}/${SETTLED_FILE}` `` off `ctx.layout.outboxDir(prd)`, with the same null guard as
  `openItemsForPrd`, mirroring `replies.mjs`'s own local `adoptedEntriesForPrd`/`status.mjs`'s
  `unreworkedDrift`. `existsSync(join(root, file))` → `` existsSync(`${ctx.root}/${settledFile}`) ``;
  `readFileSync(file, 'utf8')` → `readRepoFile(ctx, settledFile)`; `parseSettledEntries(text)` →
  `parseSettledEntries(text, ctx.markers)` (`settle.mjs`'s own already-ported signature, Task 6).
- `labels.includes('outbox:go')` and the `outbox:go` text in the wave-through line → `labels.
  includes(ctx.config.labels.outboxGo)` and `` `_These items were waved through with
  \`${ctx.config.labels.outboxGo}\` — waved through, not answered._` `` (the task's own
  mapping-table row, both the check and the printed label name).
- `/vertuo-yolo-fix` (the one runtime string literal, in `formatOutboxPrComment`'s "a reply settles
  nothing on its own" line) → `` `\`${COMMANDS.yoloFix}\`` `` (the task's own mapping-table row).
  Added `import { COMMANDS } from '../commands.mjs'`.
- **Slack: `ctx.config.notify.slack` gates the note entirely** (controller ruling 4).
  `maybeWriteSlackNote({ …, path, write })` → `maybeWriteSlackNote({ ctx, …, path, write })`: a new
  first check, `if (!ctx.config.notify.slack) return;`, before the existing "no path or no news"
  check. The upstream default Slack channel id — named only in this file's own module doc comment
  as "the #octopod note", never as a runtime literal anywhere in `outbox-comment.mjs` itself — is
  removed from the doc comment along with every other channel-specific mention; there is no literal
  channel id anywhere in this module to delete from code. TDD: RED confirmed by temporarily
  disabling the new guard and re-running the new test alone (`expected true to be false` —
  `existsSync(path)` came back `true`); GREEN confirmed after restoring the guard, same test alone,
  then the full file, then `pnpm test`.
- Every `{ root = repoRoot } = {}` (and `{ root = repoRoot, … }`) option → `{ ctx }` (rule 4);
  `repoRoot`/`here` deleted (never imported — this module used the constant only via
  `outbox.mjs`'s now-removed `repoRoot` export, itself deleted in Task 5's own port of
  `outbox.mjs`):
  - `openItemsForPrd(prd, { root = repoRoot } = {})` → `openItemsForPrd(prd, { ctx })`.
  - `readSettledEntries(prd, { root = repoRoot } = {})` → `readSettledEntries(prd, { ctx })`
    (private helper, unchanged name).
  - `adoptedEntriesForPrd(prd, { root = repoRoot } = {})` → `adoptedEntriesForPrd(prd, { ctx })`.
  - `unaccountedChanges(prd, changes, { root = repoRoot } = {})`: superseded entirely by the
    `status.mjs` import (see above) — no local definition survives to convert.
  - `upsertOutboxPrComment({ prd, root = repoRoot, now = … }, client)` →
    `upsertOutboxPrComment({ prd, ctx, now = … }, client)`.
  - `upsertOutboxComment({ prd, owner, repo, branch, ref = branch, root = repoRoot, changes = [],
    labels = [] }, client)` → `upsertOutboxComment({ prd, owner, repo, branch, ref = branch, ctx,
    changes = [], labels = [] }, client)`.
- `import { OUTBOX_DIR, RANK_ORDER, SETTLED_FILE, outboxItemFiles, parseOutboxItem, repoRoot } from
  './outbox.mjs'` → `import { RANK_ORDER, SETTLED_FILE, outboxItemFiles, parseOutboxItem } from
  './outbox.mjs'` (`OUTBOX_DIR`/`repoRoot` no longer exist in the kit's `outbox.mjs`, Task 5;
  `outboxItemFiles`'s own signature is already `outboxItemFiles({ ctx })`).
- `import { riskyChanges } from './decision-coverage.mjs'` and `import { compare, readAccounts }
  from './outbox-account.mjs'`: both deleted — no longer imported directly, since
  `unaccountedChanges` now comes whole from `status.mjs`, which already imports both itself.
- `import { ADOPTED_VERDICT, parseSettledEntries } from './outbox-settle.mjs'` → `import {
  ADOPTED_VERDICT, parseSettledEntries } from './settle.mjs'` (Task 6's own rename).
- Added `import { readRepoFile } from '../check-report.mjs'` (Task 3) — `openItemsForPrd` and
  `readSettledEntries` now read a file's text through it instead of `readFileSync(join(root, file),
  'utf8')`, the convention every other ported outbox module already follows.
- `execFileSync`/`fileURLToPath` imports: deleted (only the CLI half and `ghClient` used them).
- Module doc comment: reworded throughout to drop `docs/outbox/<prd>`, `scripts/outbox.mjs`,
  `scripts/outbox-account.mjs`, `scripts/outbox-settle.mjs`, `scripts/outbox-replies.mjs`,
  `.claude/skills/vertuo-yolo-fix/rework.mjs`, `.github/workflows/outbox.yml`, `/vertuo-yolo-fix`,
  the literal marker text (`<!-- vertuo-outbox-announced: … -->` etc.), `vertuoza/vertuo-ai-domain`
  in the `Usage:` examples, and the "#octopod" Slack channel name — in favour of
  `ctx.layout.outboxDir(prd)`, `account.mjs`/`decision-coverage.mjs`/`status.mjs`/`settle.mjs`'s own
  names, `ctx.markers.comment`/`ctx.markers.prComment`, `/omni-yolo-fix`, "the configured marker
  prefix"/"a second hidden marker" phrasing, `kit/bin` (a later task), and "the Slack note" without
  naming a channel. The `Usage:` code block (CLI flags: `--prd`, `--branch`, `--repo`, `--base`,
  `--slack-note`, `--pr`, `--result`, `--pr-comment`, `--title`, `--owner-slack-id`,
  `--owner-login`) is deleted outright — it describes the CLI half this task removes (rule 3);
  `kit/bin` (Task 15) documents its own flags when it rebuilds that half. A new closing paragraph
  ("This module builds the writer; `kit/bin` … is the caller …") replaces the old "This slice builds
  the writer; the caller that runs it is `.github/workflows/outbox.yml`'s `gate` job …" paragraph,
  for the same reason.
- Every other export (`sortItems`, `sortUnaccountedChanges`, `announcedKeys`, `assignNumbers`,
  `answeredQuestionText`, `answeredOutcome`, `formatOptionsTable`, `countsByRank`, `slackOwner`,
  `slackLine`, `readPrCommentResult`) and every private helper (`fileUrl`, `firstSentence`,
  `REWORKED_BY`, `quoteReply`, `MONTH_NAMES`, `formatApprovedAt`, `tableCell`, `quoted`,
  `otherLetter`, `hasOptions`, `openQuestionLines`, `adoptedItem`, `adoptedQuestionLines`,
  `slackEscape`, `plural`, `SLACK_USER_ID`, `ownerText`, `linkLabel`, `RANK_PLAIN_LABEL`) is
  unchanged — none of them read `root`, a marker constant, `outbox:go`, or a `/vertuo-…` command
  literal. `RANK_PLAIN_LABEL` is upstream's own dead code (defined, never read anywhere in this
  file); ported as-is, since the task is to port the file, not to clean up upstream's unused
  constants.

## Test (`comment.test.mjs`)

- Import path `./outbox-comment.mjs` → `./comment.mjs`; `./outbox-settle.mjs` → `./settle.mjs`.
- Removed from the import list (no longer exported): `ANNOUNCED_MARKER_PREFIX`, `MARKER`,
  `NUMBERS_MARKER_PREFIX`, `PR_MARKER`. Added imports: `flatCtx` (`kit/test/flat-layout.mjs`),
  `makeMarkers` (`kit/lib/markers.mjs`).
- Added a module-scope `const markers = makeMarkers('vertuo-outbox');`, matching `flatCtx`'s own
  configured prefix — every marker literal an assertion checks reproduces byte for byte, the same
  convention `replies.test.mjs` and `settle.test.mjs` already use.
- Added two module-scope `ctx` fixtures for tests that render text or parse a marker but never
  touch disk (`formatOutboxComment`, `formatOutboxPrComment`-only cases, `findMarkerComment`/
  `findPrMarkerComment`, `parseAnnouncedMarker`/`parseNumbersMarker`/`parseRoundMarkers`,
  `assignNumbers`, `answeredOutcome`): `const ctx = flatCtx('/outbox-comment-fixture');` and, for
  the pre-existing `maybeWriteSlackNote` cases which all assume Slack is configured, `const
  slackCtx = flatCtx('/outbox-comment-fixture', { notify: { slack: {} } });` — per the task's own
  Step 3 clarification ("The Slack cases pass `flatCtx(root, { notify: { slack: {} } })`"). Neither
  fixture's root is ever created on disk: nothing either `ctx` or `slackCtx` is used for in these
  cases reads `ctx.root` — only `ctx.markers`, `ctx.config.labels.outboxGo`, `ctx.config.notify.
  slack`, and `flatLayout`'s pure `outboxDir(prd)` string computation. A test that does touch disk
  builds its own `flatCtx(root)` off a real `withFixtureRoot` root instead, exactly as every other
  ported outbox test file already does.
- Every `{ root }` (or a bare `root` field) passed to a function whose signature grew `{ ctx }` —
  `openItemsForPrd`, `unaccountedChanges`, `upsertOutboxComment`, `upsertOutboxPrComment`,
  `settleItem` (inside the `settle` test helper), `adoptItem` (inside `adoptOptioned`) — became `{
  ctx: flatCtx(root) }`, built fresh at each call site, per Port Protocol rule 6 and the same
  convention `status.test.mjs`/`replies.test.mjs` already use.
- `formatOutboxComment({ ...base, … })`: `base` gained `ctx` (the module-scope fixture, above).
- `formatOutboxPrComment({ …, numbering, … })` calls: every one gained `ctx` (module-scope fixture,
  or `flatCtx(root)` inside a `withFixtureRoot` block where one is already open).
- `MARKER` → `markers.comment`; `PR_MARKER` → `markers.prComment`, everywhere a fixture comment body
  or an assertion named one of them.
- `ANNOUNCED_MARKER_PREFIX` → `markers.announcedPrefix`; `NUMBERS_MARKER_PREFIX` →
  `markers.numbersPrefix`.
- `parseAnnouncedMarker(body)` → `parseAnnouncedMarker(body, markers)`; `findMarkerComment(comments)`
  → `findMarkerComment(comments, markers)`; `findPrMarkerComment(comments)` →
  `findPrMarkerComment(comments, markers)`; `formatNumbersMarker(numbering)` →
  `formatNumbersMarker(numbering, markers)`; `parseNumbersMarker(body)` → `parseNumbersMarker(body,
  markers)`; `parseRoundMarkers(comments)` → `parseRoundMarkers(comments, markers)`.
- The two hard-coded round-marker literals in the `parseRoundMarkers` describe block
  (`'<!-- vertuo-outbox-round: 2 1,3 -->'`, `'<!-- vertuo-outbox-round: 2 1 -->'` /
  `'<!-- vertuo-outbox-round: 3 1 -->'`) and the two in the `upsertOutboxPrComment` describe block
  → `` `${markers.round(2, [1, 3])}` `` / `` `${markers.round(2, [1])}` `` / `` `${markers.round(3,
  [1])}` ``, matching `replies.test.mjs`'s own convention for the same marker.
- `settle(root, file, { … })` helper: `settleItem({ root, file, answer })` → `settleItem({ ctx:
  flatCtx(root), file, answer })`.
- `parseSettledOf(root, prd)` helper: `parseSettledEntries(readFileSync(path, 'utf8'))` →
  `parseSettledEntries(readFileSync(path, 'utf8'), markers)` (`settle.mjs`'s own already-ported
  signature, Task 6).
- `adoptOptioned(root, spec)` helper: `adoptItem({ root, itemText })` → `adoptItem({ ctx:
  flatCtx(root), itemText })`.
- `objectTo(root, spec, { text })` helper: `renderSettledEntry({ item, itemText, answer, judgement
  })` → same call plus `markers` (`settle.mjs`'s own already-ported signature, Task 6).
- **Assertion changes, all "command names in rendered text" per the task's own Step 3 allowance**:
  - `expect(body).toContain('/vertuo-yolo-fix');` (in the worst-first `formatOutboxPrComment`
    scenario) → `expect(body).toContain('/omni-yolo-fix');`.
  - The one literal `` '_A reply settles nothing on its own — `/vertuo-yolo-fix` reads the replies
    and settles ' + 'them._'`` inside the big byte-for-byte body comparison (the "renders a PRD with
    one high, one human-action and two adopted items…" test) → `` '_A reply settles nothing on its
    own — `/omni-yolo-fix` reads the replies and settles ' + 'them._'``.
  - Every literal `<!-- vertuo-outbox-… -->` an assertion names (announced-keys marker, numbers
    marker, round marker) is unchanged VALUE-wise — only how the test *constructs* the expected
    string changed (an imported constant → `markers.<field>`), since `flatCtx`'s configured prefix
    (`vertuo-outbox`) is byte-identical to upstream's own hard-coded prefix. No test's expected
    *value* differs from upstream's.
- **New test, TDD RED then GREEN (Step 4)**: `describe('maybeWriteSlackNote', …)` gained "writes
  nothing when the repository has not opted in to Slack notifications (notify.slack is null)" — a
  real fixture root, `ctx = flatCtx(root)` (Slack left at its default `null`), and an assertion that
  `existsSync(path)` is `false` after calling `maybeWriteSlackNote` with the same "there is news"
  shape every other case in the block uses. RED: temporarily commented out the new `if
  (!ctx.config.notify.slack) return;` guard in `comment.mjs` and ran this test alone —
  `AssertionError: expected true to be false` (the note file was written). GREEN: restored the
  guard, ran this test alone, then the whole file, then `pnpm test` — all green.
- **Deleted: none.** Upstream's test file (`outbox-comment.test.mjs`) carries no CLI-invoking test
  (no `execFileSync`, no `realRepoRoot`, no `ghClient` test) to delete under rule 6.

## Consequence for `kit/lib/outbox/replies.mjs` (controller ruling 3)

Once this module exported `findPrMarkerComment(comments, markers)`, `parseNumbersMarker(body,
markers)`, `parseRoundMarkers(comments, markers)`, `openItemsForPrd(prd, { ctx })`, and
`adoptedEntriesForPrd(prd, { ctx })`, `replies.mjs`'s five private, non-exported copies of those
same functions (built during Task-11-comes-before-this-one's earlier port of `replies.mjs`,
`kit/porting/outbox--replies.md`) were deleted and replaced with an import from `./comment.mjs`. No
import cycle: `comment.mjs` imports `outbox.mjs`, `settle.mjs`, `status.mjs`,
`check-decision-coverage.mjs`, `check-report.mjs`, `commands.mjs` — none of which import
`replies.mjs`. `replies.test.mjs`'s `formatNumbersMarkerFixture` helper (a hand-rebuilt copy of the
round-trip algorithm, written because `outbox-comment.mjs` was not yet ported) was replaced with the
real `formatNumbersMarker` imported from `./comment.mjs`. See `kit/porting/outbox--replies.md`'s own
updated "Superseded by Task 11" section for the exact diff.

## Gate

`pnpm vitest run kit/lib/outbox/comment.test.mjs kit/lib/outbox/replies.test.mjs
kit/test/no-literals.test.mjs` — 164/164 pass (120 in `comment.test.mjs`, 43 in
`replies.test.mjs`, 1 in `no-literals.test.mjs`). Full `pnpm test` — 626/626 pass (32 files).

## Final review fixes

- `formatOutboxComment` takes `unreworked` (`unreworkedDrift`'s result, passed by
  `upsertOutboxComment`): when nothing is open but drift is unreworked, the "Nothing open" line is
  replaced by one naming the drifted ids and `COMMANDS.yoloFix`. Test: "names unreworked drift and
  the fix command instead of \"Nothing open\" when nothing is open".
- `parseNameStatus` is re-exported from `kit/lib/git.mjs` (the one implementation), no longer via
  `check-decision-coverage.mjs`. Test: `kit/lib/git.test.mjs` "is one implementation…".

## PRD 50, slice s2: the intro and the punchline

Not a re-port: upstream's `scripts/outbox-comment.mjs` has no intro or punchline. A kit-local
widening of the ported pull request comment, recorded here because `comment.mjs` is this record's
territory.

- Added `import { assignBanter } from './banter.mjs'`. `kit/lib/outbox/banter.mjs` is a new,
  kit-local module (the fallback pool of intros and punchlines, `stableHash` and `assignBanter`);
  nothing in it is ported, so it has no porting record of its own.
- New private helper `funLine(text)`: the line in italics (`_…_`), trimmed and on one line, since a
  line break inside would end the emphasis.
- New private helper `questionBanter({ items, adopted, numberById })`: the intro and the punchline
  of every question the comment shows, by item id — the item's own `sections.introFun` /
  `sections.punchlineFun` (PRD 50, slice s1) when it carries both, otherwise the pool's through
  `assignBanter`. Open and adopted questions are served together in question-number order (an
  unnumbered one last, then by id), not in the order the comment lists them, so two renders agree
  and a new question never moves an older one's lines. A question carrying its own pair takes no
  pool line. An adopted entry's embedded item is read through the existing `adoptedItem`; one that
  cannot be read gets the pool's pair.
- `openQuestionLines(item, number, round)` → `openQuestionLines(item, number, round, banter)`: after
  the heading, the intro; after the quoted question, the punchline; then the options, the person
  steps or the older decision line, unchanged.
- `adoptedQuestionLines(entry, number, round)` → `adoptedQuestionLines(entry, number, round,
  banter)`: the same two lines around the quoted question. No separator is added between adopted
  questions; the section keeps its one rule before `<details>`.
- `formatOutboxPrComment`: computes `questionBanter` once and hands each question its pair. Its doc
  comment gained a sentence on the pair.
- Module doc comment: a paragraph on the pair ("PRD #50, slice s2 — a joke around every question").
- Unchanged: the **Answered** section, `formatOutboxComment` (the PRD issue's comment), `slackLine`,
  `maybeWriteSlackNote`, and both upsert functions.

### Test (`comment.test.mjs`)

- Added import: `BANTER_POOL`, `assignBanter` (`./banter.mjs`).
- `optionedItemText` gained `introFun` and `punchlineFun` (written together, right after the plain
  decision, when `introFun` is given), and `options: null` (no options and no person steps, the shape
  of an item raised before options existed). Its defaults are unchanged, so every existing fixture is
  byte-identical.
- **Changed**: "renders a PRD with one high, one human-action and two adopted items as the
  before/after page lays it out" — its four items now carry their own intro and punchline, and the
  expected body carries each pair around its question. The only existing assertion changed.
- **Added** `an intro and a punchline around every question (PRD #50 s2)`: the order separator,
  heading, intro, question, punchline, then the rest, for an open question with options, a
  `human-action` one with person steps, one with the older decision line, and adopted ones with
  options and with a decision line; pool lines for items without the pair, open and adopted; a
  question with its own pair taking no pool line; two renders identical, and a rewrite in place
  through `upsertOutboxPrComment` identical; two ids hashing to the same line getting different
  lines, the lower number keeping it; questions served in number order, not listing order (a high
  question listed before a medium one numbered earlier, and an open one listed before an adopted one
  numbered earlier); a new, more urgent question hashing to question 1's line leaving questions 1–3
  unchanged; no pool line repeated across twelve questions; no intro or punchline in the Answered
  section. RED: eleven of these thirteen failed, with the changed test, before `comment.mjs`
  rendered the pair; the other two passed from the start — "rendering the comment twice gives the
  same lines" (true of any pure render) and the Answered one, which pins what stays the same.
- No assertion deleted. The Answered, PRD-issue comment and Slack tests are unchanged.

### Gate (this update)

`pnpm vitest run kit/lib/outbox/comment.test.mjs kit/lib/outbox/banter.test.mjs
kit/test/no-literals.test.mjs` — 152/152 pass (134 in `comment.test.mjs`, 16 in
`banter.test.mjs`, 2 in `no-literals.test.mjs`).

## PRD 251, slice s10: the Omni page line

Not a re-port: upstream's `scripts/outbox-comment.mjs` has no Omni page. A kit-local widening of
the pull request comment, recorded here because `comment.mjs` is this record's territory. Carried
over unchanged from the first build's slice s4 (tag `archive/outbox-answers-v1`, sub-PR #258).

- New export `omniPageLink(prd, ctx)`: `<ask.url>/prd/at/<repo.slug>/<prd>`, a trailing slash of
  `ask.url` dropped, or `null` unless `answers.enabled` is on, `ask.url` is set, `repo.slug` is set
  and `prd` is a positive integer. It names only the address the repository configured; the kit
  still never names the page behind it.
- `formatOutboxPrComment({ …, ctx })` → `formatOutboxPrComment({ …, prd = null, ctx })`: when
  `omniPageLink` gives an address, one line right under the header (whichever it is, "No open
  items." included), then an empty line: `Answer here, or on the Omni page: <address>`. Without
  `prd`, no line, so every existing call renders byte for byte as before.
- `upsertOutboxPrComment` passes its `prd` through. The omni-loop App's evaluation calls it, so the
  comment the App posts carries the line on the same conditions.
- Unchanged: every other section, `formatOutboxComment` (the PRD issue's comment), the markers.

### Test (`comment.test.mjs`)

- **Added** `the Omni page line (PRD 251, "The Outbox tab")`: the line right under the header with
  the switch on and `ask.url` set, exactly once; under "No open items." too; a trailing slash
  dropped; absent with the switch off, without `ask.url`, without a slug, and without the PRD; and
  written by `upsertOutboxPrComment`. RED: four of the seven failed before `comment.mjs` wrote the
  line; the three absences passed from the start, pinning what stays the same.
- No existing assertion changed or deleted.

### Gate (this update)

`pnpm vitest run kit/lib/outbox/comment.test.mjs kit/test/no-literals.test.mjs
kit/test/dist.test.mjs kit/test/no-game-words.test.mjs` — 154/154 pass, with the bundle rebuilt by
`pnpm kit:build`.
