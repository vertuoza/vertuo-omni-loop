/**
 * **The PRD issue carries one comment, kept current** (PRD #985, slice s4).
 *
 * One comment on the PRD issue, found by its marker and rewritten in place — never appended. It
 * lists every open item raised so far, across every wave, with its rank and a link to the file on
 * the branch. A second wave that raises a new item, or settles one, edits the SAME comment; it
 * never leaves a trail of stale ones behind.
 *
 * Reads open items through `outbox.mjs` — this module globs no markdown of its own;
 * {@link openItemsForPrd} only filters `outboxItemFiles()`'s result down to one PRD and parses each
 * with `parseOutboxItem`. A file that fails to parse is `check-outbox.mjs`'s job to catch, not this
 * writer's — it silently leaves a malformed item off the comment rather than crashing a wave over
 * someone else's guard.
 *
 * **The GitHub calls are a seam** (`listComments` / `createComment` / `updateComment`), so
 * {@link upsertOutboxComment} is testable against a fake with no network — this module does no
 * network I/O and never shells out to `gh` itself; `kit/bin` (a later task) supplies the production
 * client, finding the marker comment with a `GET` and rewriting it with a `PATCH` by its numeric
 * id — never "edit the last comment", because "last" is not "ours": another comment posted after
 * ours would make that clobber it.
 *
 * **The same comment also names unaccounted risky changes** (PRD #1044, slice s5), under the open
 * items, each with its path and the rule that flagged it — still exactly one comment; the open-item
 * section above is generated exactly as it was and is never restructured. The list comes from two
 * modules PRD #1044 already merged: `decision-coverage.mjs`'s `riskyChanges` grades the `changes`
 * the caller hands in (a range's `git diff --name-status`), and `account.mjs`'s `readAccounts` +
 * `compare` say which of them nobody wrote an account for — read here through {@link
 * unaccountedChanges}, imported from `status.mjs` rather than duplicated, since the gate's own
 * reading and this comment's reading are the exact same computation. Omitting `changes` skips the
 * range check entirely, and the unaccounted list is empty.
 *
 * **PRD #1057, slice s1 — the writer gains a postman-ready shape.** Four small changes, all still
 * proved against a fake client, no network: (1) nothing is created when there is nothing to list —
 * an existing comment is still always updated, down to "nothing open" if that is what is left; (2)
 * item links carry a `ref` (the pull request's head SHA) when the caller has one, falling back to
 * `branch` so the pre-existing usage keeps working; (3) a pull request carrying the label named by
 * `ctx.config.labels.outboxGo`, with at least one open item still open, gets one line saying so, not
 * answered; (4) the body carries a second hidden marker listing every item id and `<rule>:<path>`
 * pair the comment currently names, sorted and comma-separated ({@link announcedKeys}), so the next
 * run can tell what it has already told the owner about. **News** is a key the new body carries
 * that the previous marker comment's body did not (every key, the first time the comment is
 * created). `slackLine` turns a PRD number, its open counts by rank, its unaccounted count, its news
 * count and the comment's own `html_url` into one plain-English line, and {@link
 * maybeWriteSlackNote} writes it to a file only when there is news — and only when the repository
 * has opted in to Slack notifications at all (`ctx.config.notify.slack` is not `null`).
 *
 * **PRD #1071, slice s2 — the feature pull request asks every question, in plain words.** A second,
 * unrelated comment: {@link upsertOutboxPrComment} writes to the FEATURE PULL REQUEST itself (not
 * the PRD issue), found by its own marker (`ctx.markers.prComment`, never confused with `ctx.markers.
 * comment` above — the two never share a prefix boundary) and rewritten in place, same discipline.
 * It reads the same {@link openItemsForPrd}, but renders each item's `sections.questionPlain`/
 * `decisionPlain` (PRD #1071 slice s1) instead of a developer-facing link, worst-first, each under
 * its own permanent number — assigned once, in {@link assignNumbers}, and never reused (see the
 * hidden numbering marker, {@link formatNumbersMarker} / {@link parseNumbersMarker}, read back by
 * the kit's own reply reader). Below the open questions, an **Answered** section reads the PRD's
 * settled ledger through `settle.mjs`'s own `parseSettledEntries` — never a second parser for that
 * ledger — and shows only the entries whose item id already holds a number (an entry settled before
 * this comment ever existed carries no number and is left out). A question a round comment (some
 * OTHER comment on the same pull request, carrying its own round marker) has re-asked is marked
 * "asked again in round N" — {@link parseRoundMarkers} reads every comment the caller's
 * `listComments()` hands back, exactly the way the numbering marker is read off the main comment
 * itself. With nothing open and no settled entry carrying a number, and no existing comment, nothing
 * is posted — same "skip, never create empty" rule {@link upsertOutboxComment} already keeps for the
 * PRD issue. An existing comment is always rewritten, down to "Every question is answered" once
 * nothing is left open — it stays on the pull request as the permanent record. {@link
 * formatOutboxComment} (the PRD-issue writer, above) is untouched by any of this.
 *
 * **PRD #1166, slice s7 — the Slack note says whose it is and what it is about.** {@link slackLine}
 * writes three lines of Slack mrkdwn: the PRD's number and title, its owner (a `<@U…>` mention, or
 * the GitHub handle when Slack does not know them — {@link slackOwner} picks), the counts in words
 * with adopted items apart from the ones that need a decision, and a `<url|label>` link to the
 * feature pull request's outbox comment. The Slack lookup and the title read live in the caller,
 * which hands them in; the pull request run goes FIRST and leaves its url and newly adopted count
 * for the PRD-issue run to read back with {@link readPrCommentResult}. A newly adopted item is news.
 *
 * **PRD #50, slice s2 — a joke around every question.** Every open and every adopted question on the
 * pull request comment reads: its heading, an intro in italics, the quoted question, a punchline in
 * italics, then its options, the steps a person must take, or the older decision line. The pair is
 * the item's own when it carries one (`sections.introFun` / `sections.punchlineFun`, PRD #50 slice
 * s1); otherwise it comes from the kit's pool in `banter.mjs`, keyed on a stable hash of the item's
 * id and served in question-number order (see {@link questionBanter}), so rewriting the comment
 * over the same questions keeps every line and a new question never moves an older one's. The
 * **Answered** section, the PRD issue's comment and the Slack note carry neither.
 *
 * This module builds the writer; `kit/bin` (a later task) is the caller that runs it from the gate
 * job, against the feature pull request.
 */
// Ported from vertuo-ai-domain@c4a210122:scripts/outbox-comment.mjs — changes in kit/porting/outbox--comment.md.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { readRepoFile } from '../check-report.mjs';
import { COMMANDS } from '../commands.mjs';
import { assignBanter } from './banter.mjs';
import { RANK_ORDER, SETTLED_FILE, outboxItemFiles, parseOutboxItem } from './outbox.mjs';
import { ADOPTED_VERDICT, parseSettledEntries } from './settle.mjs';
import { unaccountedChanges, unreworkedDrift } from './status.mjs';

export { parseNameStatus } from '../git.mjs';
export { unaccountedChanges };

/**
 * Every open item, across every wave, that belongs to `prd` — reusing `outboxItemFiles` for the
 * listing rather than globbing the outbox tree again here, then filtering to the one PRD's own
 * directory and parsing each file. Malformed items are skipped rather than thrown: this writer
 * reports what it can read, and the outbox guard is what refuses a malformed one. A PRD with no
 * inbox or shipped folder at all (`ctx.layout.outboxDir(prd)` is `null`) has nothing open.
 *
 * @param {number} prd
 * @param {{ ctx: object }} options
 * @returns {object[]} parsed items (see `outbox.mjs`'s `parseOutboxItem`), unsorted
 */
export function openItemsForPrd(prd, { ctx }) {
  const outboxDir = ctx.layout.outboxDir(prd);
  if (outboxDir === null) return [];
  const prefix = `${outboxDir}/`;
  const items = [];
  for (const file of outboxItemFiles({ ctx })) {
    if (!file.startsWith(prefix)) continue;
    const parsed = parseOutboxItem(readRepoFile(ctx, file), { file });
    if (parsed.ok) items.push(parsed.item);
  }
  return items;
}

/**
 * Open items, worst-first: `human-action`, then `high`, then `medium`, ties broken by `id` so the
 * comment's order is stable run to run rather than depending on directory listing order. Pure —
 * returns a new array, never mutates its input.
 */
export function sortItems(items) {
  return [...items].sort((a, b) => {
    const byRank = RANK_ORDER[b.rank] - RANK_ORDER[a.rank];
    return byRank !== 0 ? byRank : a.id.localeCompare(b.id);
  });
}

function fileUrl({ owner, repo, ref, file }) {
  return `https://github.com/${owner}/${repo}/blob/${ref}/${file}`;
}

/**
 * Unaccounted changes, path then rule, ties broken lexically so the comment's order is stable run
 * to run — the same reasoning `sortItems` uses for open items. Pure — returns a new array, never
 * mutates its input.
 */
export function sortUnaccountedChanges(changes) {
  return [...changes].sort((a, b) => {
    const byPath = a.path.localeCompare(b.path);
    return byPath !== 0 ? byPath : a.rule.localeCompare(b.rule);
  });
}

/**
 * The sorted, deduplicated set of keys a comment listing `items` and `unaccounted` announces — an
 * item's `id`, and `<rule>:<path>` for an unaccounted change. Pure.
 *
 * @param {{ items: { id: string }[], unaccounted: { path: string, rule: string }[] }} args
 * @returns {string[]}
 */
export function announcedKeys({ items, unaccounted }) {
  const keys = [
    ...items.map((item) => item.id),
    ...unaccounted.map((change) => `${change.rule}:${change.path}`),
  ];
  return [...new Set(keys)].sort();
}

/** The hidden marker line naming `keys`, comma-separated. */
function formatAnnouncedMarker(keys, markers) {
  return `${markers.announcedPrefix}${keys.join(',')}${markers.announcedSuffix}`;
}

/**
 * The announced keys a comment body carries — `[]` when the body carries no marker (an older
 * comment, or none at all) or an empty one.
 *
 * @param {string | undefined | null} body
 * @param {object} markers
 * @returns {string[]}
 */
export function parseAnnouncedMarker(body, markers) {
  if (typeof body !== 'string') return [];
  const match = body.match(markers.announcedRe);
  if (!match) return [];
  const value = match[1].trim();
  return value === '' ? [] : value.split(',');
}

/**
 * The comment body: the marker on its own first line (so `findMarkerComment` can find it back),
 * then every open item with its rank and a link to the file at `ref` (falling back to `branch` when
 * no `ref` is given — the pre-existing callers' shape), a line naming the branch, and — only when
 * the pull request carries the label named by `ctx.config.labels.outboxGo` and at least one item is
 * still open — a line saying those items were waved through, not answered. Then, only when
 * `unaccounted` is non-empty, a block naming every unaccounted risky change with its path and the
 * rule that flagged it. Finally the hidden announced-keys marker, always present, naming every key
 * this body lists (see {@link announcedKeys}). Pure — no GitHub call, no filesystem access.
 *
 * When nothing is open but `unreworked` (`unreworkedDrift`'s `{ id }[]`) is not empty, the
 * "nothing open" line instead names those ids and the fix command.
 *
 * @param {{ prd: number, owner: string, repo: string, branch: string, ref?: string, items: object[], unaccounted?: { path: string, rule: string }[], unreworked?: { id: string }[], labels?: string[], ctx: object }} args
 */
export function formatOutboxComment({
  prd,
  owner,
  repo,
  branch,
  ref = branch,
  items,
  unaccounted = [],
  unreworked = [],
  labels = [],
  ctx,
}) {
  const sorted = sortItems(items);
  const lines = [ctx.markers.comment, '', `**Outbox — open items for PRD #${prd}**`, ''];

  if (sorted.length === 0) {
    lines.push('No open items.');
  } else {
    for (const item of sorted) {
      const url = fileUrl({ owner, repo, ref, file: item.file });
      lines.push(`- \`${item.rank}\` — [${item.id}](${url})`);
    }
  }

  lines.push('');
  if (sorted.length > 0) {
    lines.push(
      `_${sorted.length} open item(s) on \`${branch}\`. Settled items move to ` +
        `\`${ctx.layout.outboxDir(prd)}/settled.md\`._`,
    );
  } else if (unreworked.length > 0) {
    // Nothing open is not the same as nothing to do: a drifted answer still holds the gate.
    lines.push(
      `_No open item on \`${branch}\`, but drifted and not yet reworked: ` +
        `${unreworked.map((entry) => entry.id).join(', ')} — run \`${COMMANDS.yoloFix}\`._`,
    );
  } else {
    lines.push(`_Nothing open on \`${branch}\`._`);
  }

  if (sorted.length > 0 && labels.includes(ctx.config.labels.outboxGo)) {
    lines.push('');
    lines.push(
      `_These items were waved through with \`${ctx.config.labels.outboxGo}\` — waved through, not answered._`,
    );
  }

  const sortedUnaccounted = sortUnaccountedChanges(unaccounted);
  if (sortedUnaccounted.length > 0) {
    lines.push('');
    lines.push(`**Unaccounted changes — PRD #${prd}**`);
    lines.push('');
    for (const change of sortedUnaccounted) {
      lines.push(`- \`${change.rule}\` — \`${change.path}\``);
    }
  }

  lines.push('');
  lines.push(
    formatAnnouncedMarker(
      announcedKeys({ items: sorted, unaccounted: sortedUnaccounted }),
      ctx.markers,
    ),
  );

  return lines.join('\n');
}

/**
 * The one comment carrying `marker`, among a PRD issue's comments — or `null` when none does. Never
 * assumes it is the newest comment (see the module doc on why "edit the last comment" is unsafe
 * here): it is found by content, not by position.
 *
 * @param {Array<{ id: number, body?: string }> | undefined | null} comments
 */
function findCommentByMarker(comments, marker) {
  if (!Array.isArray(comments)) return null;
  return (
    comments.find((comment) => typeof comment.body === 'string' && comment.body.includes(marker)) ??
    null
  );
}

export function findMarkerComment(comments, markers) {
  return findCommentByMarker(comments, markers.comment);
}

/**
 * The one comment carrying `markers.prComment`, among the feature pull request's comments — or
 * `null` when none does. Same "found by content, not by position" discipline as {@link
 * findMarkerComment}.
 *
 * @param {Array<{ id: number, body?: string }> | undefined | null} comments
 */
export function findPrMarkerComment(comments, markers) {
  return findCommentByMarker(comments, markers.prComment);
}

// ---- The pull request comment (PRD #1071, slice s2) ----

/** How each rank reads in plain words, on the pull request comment. */
const RANK_PLAIN_LABEL = { 'human-action': 'needs a person', high: 'high', medium: 'medium' };

/**
 * The hidden marker naming every question number the pull request comment has ever assigned:
 * `<number>=<item id>@<ISO time first listed>`, comma-separated, sorted by number. Pure.
 *
 * @param {{ number: number, id: string, since: string }[]} numbering
 * @param {object} markers
 */
export function formatNumbersMarker(numbering, markers) {
  const body = [...numbering]
    .sort((a, b) => a.number - b.number)
    .map((entry) => `${entry.number}=${entry.id}@${entry.since}`)
    .join(',');
  return `${markers.numbersPrefix}${body}${markers.numbersSuffix}`;
}

/**
 * The numbering a pull request comment body carries — `[]` when it carries no marker (no comment
 * yet) or an empty one. The inverse of {@link formatNumbersMarker}; round-trips exactly.
 *
 * @param {string | undefined | null} body
 * @param {object} markers
 * @returns {{ number: number, id: string, since: string }[]}
 */
export function parseNumbersMarker(body, markers) {
  if (typeof body !== 'string') return [];
  const match = body.match(markers.numbersRe);
  if (!match) return [];
  const value = match[1].trim();
  if (value === '') return [];
  return value.split(',').map((entry) => {
    const [numberPart, rest] = entry.split(/=(.*)/s);
    const at = rest.lastIndexOf('@');
    return { number: Number(numberPart), id: rest.slice(0, at), since: rest.slice(at + 1) };
  });
}

/**
 * Assigns every open item a permanent question number: on the first write (`previous` empty),
 * worst-first, starting at 1 — the same order {@link sortItems} already gives the PRD-issue comment.
 * On a later write, an item `previous` already numbers keeps that number untouched; only an item
 * `previous` has never seen gets a fresh one, worst-first among just the newcomers, starting at
 * `max(previous numbers) + 1`. Numbers already handed out are never reused, even once their item
 * settles and disappears from `items` — {@link upsertOutboxPrComment} always folds this function's
 * result back into `previous` on the next call, via the marker. Pure but for `now`, injectable so a
 * test can pin the timestamp new entries get.
 *
 * @param {{ items: { id: string, rank: string }[], previous?: { number: number, id: string, since: string }[], now?: () => string }} args
 * @returns {{ number: number, id: string, since: string }[]}
 */
export function assignNumbers({ items, previous = [], now = () => new Date().toISOString() }) {
  const known = new Set(previous.map((entry) => entry.id));
  const maxNumber = previous.reduce((max, entry) => Math.max(max, entry.number), 0);
  const fresh = sortItems(items.filter((item) => !known.has(item.id)));
  if (fresh.length === 0) return [...previous];

  const since = now();
  let next = maxNumber + 1;
  const additions = fresh.map((item) => ({ number: next++, id: item.id, since }));
  return [...previous, ...additions];
}

/**
 * The latest round each question number was re-asked in — read off every OTHER comment on the pull
 * request that carries a round marker. A number a later round also re-asks keeps only the higher
 * round; a number no round comment ever names is absent from the map, never zero. Pure.
 *
 * @param {Array<{ body?: string }> | undefined | null} comments every comment `listComments()` gives back
 * @param {object} markers
 * @returns {Map<number, number>}
 */
export function parseRoundMarkers(comments, markers) {
  const rounds = new Map();
  for (const comment of comments ?? []) {
    if (typeof comment.body !== 'string') continue;
    const match = comment.body.match(markers.roundRe);
    if (!match) continue;
    const round = Number(match[1]);
    for (const numberText of match[2].split(',')) {
      if (!numberText) continue;
      const number = Number(numberText);
      const current = rounds.get(number);
      if (current === undefined || round > current) rounds.set(number, round);
    }
  }
  return rounds;
}

/** Reads a PRD's `settled.md` back into entries, through `settle.mjs`'s own reader — never a second
 * parser for the same ledger. A PRD with no inbox or shipped folder, or an absent ledger, reads as
 * no entries at all, the same as a PRD that has settled nothing yet. */
function readSettledEntries(prd, { ctx }) {
  const outboxDir = ctx.layout.outboxDir(prd);
  if (outboxDir === null) return [];
  const settledFile = `${outboxDir}/${SETTLED_FILE}`;
  if (!existsSync(`${ctx.root}/${settledFile}`)) return [];
  return parseSettledEntries(readRepoFile(ctx, settledFile), ctx.markers);
}

/**
 * The PRD's adopted items (PRD #1166 s6): the settled entries whose LATEST verdict is `adopted` —
 * an adopted item someone has since objected to carries a later `drifted` entry and is not one.
 * Exported so the kit's own reply reader reads the same list the comment shows.
 *
 * @param {number} prd
 * @param {{ ctx: object }} options
 */
export function adoptedEntriesForPrd(prd, { ctx }) {
  return readSettledEntries(prd, { ctx }).filter((entry) => entry.verdict === ADOPTED_VERDICT);
}

/** The first sentence of `text` — the fallback question text for a settled entry whose embedded item
 * predates slice s1's plain sections (`sections.questionPlain` is `undefined`). Mirrors
 * `outbox.mjs`'s own sentence-counting rules closely enough to grab just the first one. */
function firstSentence(text) {
  const trimmed = (text ?? '').trim();
  const match = trimmed.match(/[^.!?]+(?:[.!?]+|$)/);
  return (match ? match[0] : trimmed).trim();
}

/**
 * The question text an Answered line shows for a settled entry: the embedded item's own
 * `sections.questionPlain` (PRD #1071 slice s1) when it has one, or — for an entry settled before
 * that slice landed, whose embedded item carries no plain sections at all — the first sentence of
 * *What I had to decide*. The embedded item text was already validated by `settleItem` before it was
 * written, so a parse failure here is not expected; it falls back to the empty string rather than
 * throwing, the same "report what can be read" stance `openItemsForPrd` takes.
 *
 * @param {{ itemText: string }} entry a `parseSettledEntries` entry
 * @returns {string}
 */
export function answeredQuestionText(entry) {
  const parsed = parseOutboxItem(entry.itemText, { file: null });
  if (!parsed.ok) return '';
  const { sections } = parsed.item;
  return sections.questionPlain ?? firstSentence(sections.whatIHadToDecide);
}

/** `#1090` — the rework sub-pull request `/omni:yolo-fix` named when it closed a drifted entry (the
 * kit's own rework step amends the `Closed:` field to `yes — reworked by #<n>, …`). Read
 * independently here rather than imported — this module's own territory is the outbox comments, and
 * the two already agree on the exact wording the amendment writes. */
const REWORKED_BY = /reworked by #(\d+)/;

/**
 * The outcome an Answered line shows: _kept as built_ for an agreed verdict; _reworked in #N_ for a
 * drifted one a rework sub-pull request has already closed; _to be reworked_ for a drifted one still
 * open. Pure.
 *
 * @param {{ verdict: string, closed: boolean, fields: Record<string, string> }} entry
 * @returns {string}
 */
export function answeredOutcome(entry) {
  if (entry.verdict === 'agreed') return 'kept as built';
  const reworkedBy = entry.closed ? (entry.fields?.Closed ?? '').match(REWORKED_BY)?.[1] : null;
  return reworkedBy ? `reworked in #${reworkedBy}` : 'to be reworked';
}

/** `"…"`, one line, trimmed to a readable length — how an Answered line quotes the reply it settled
 * on. Pure. */
function quoteReply(text) {
  const oneLine = (text ?? '').replace(/\s+/g, ' ').trim();
  const truncated = oneLine.length > 120 ? `${oneLine.slice(0, 117)}…` : oneLine;
  return `"${truncated}"`;
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** `23 Sep` — a plain, timezone-free reading of an ISO date or date-time's own date part, for an
 * Answered line's "when". Anything that does not start `YYYY-MM-DD` is returned unchanged rather
 * than guessed at. */
function formatApprovedAt(approvedAt) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(approvedAt ?? '');
  if (!match) return approvedAt ?? '';
  const [, , month, day] = match;
  return `${Number(day)} ${MONTH_NAMES[Number(month) - 1]}`;
}

/** Escapes a table cell: a `|` would split the row, and a line break would end it. */
function tableCell(text) {
  return String(text ?? '')
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\|/g, '\\|');
}

/** The question as a markdown quote — every line quoted, so a two-line question stays one quote. */
function quoted(text) {
  return String(text ?? '')
    .trim()
    .split('\n')
    .map((line) => (line.trim() === '' ? '>' : `> ${line}`))
    .join('\n');
}

/** An intro or a punchline in italics, on one line — a line break inside would end the emphasis. */
function funLine(text) {
  return `_${String(text ?? '')
    .trim()
    .replace(/\s*\n\s*/g, ' ')}_`;
}

/**
 * The options as a table, A marked with `mark` (`recommended · built` on an open question, `adopted ·
 * built` on an adopted one) — option A is always the one built (PRD #1166, Durable decision "The
 * options section"), so no reader has to look for which row carries the mark. Pure.
 *
 * @param {{ letter: string, text: string }[]} options
 * @param {string} mark
 */
export function formatOptionsTable(options, mark) {
  return [
    '|   | Option | |',
    '| --- | --- | --- |',
    ...options.map(
      (option) =>
        `| ${option.letter} | ${tableCell(option.text)} | ${option.letter === 'A' ? `✅ ${mark}` : ''} |`,
    ),
  ];
}

/** The first offered letter that is not A — what the reply line suggests as the way to disagree. */
function otherLetter(options) {
  return options.find((option) => option.letter !== 'A')?.letter ?? 'B';
}

/** Whether an item offers options to choose between (PRD #1166 s4); a legacy item offers none. */
function hasOptions(item) {
  return Array.isArray(item.sections?.options) && item.sections.options.length > 0;
}

/**
 * The intro and the punchline each question the pull request comment shows carries (PRD #50, slice
 * s2), by item id: the item's own `sections.introFun` and `sections.punchlineFun` when it has them,
 * and otherwise the kit's pool's, through `banter.mjs`'s `assignBanter`. The questions are served in
 * number order — open and adopted together, not in the order the comment lists them — so a
 * question's pool lines depend only on the questions numbered before it: two renders give the same
 * lines, and a new question, always numbered after every older one, never changes an older one's.
 * A question carrying its own pair takes no pool line. Only the questions shown take one: a question
 * answered, and so gone to the Answered section, frees its lines for the questions after it. Pure.
 *
 * @param {{ items: object[], adopted: object[], numberById: Map<string, number> }} args
 * @returns {Map<string, { intro: string, punchline: string }>}
 */
function questionBanter({ items, adopted, numberById }) {
  const numberOf = (question) => numberById.get(question.id) ?? Infinity;
  const questions = [
    ...items.map((item) => ({ id: item.id, sections: item.sections })),
    ...adopted.map((entry) => ({ id: entry.id, sections: adoptedItem(entry)?.sections })),
  ].sort((a, b) => numberOf(a) - numberOf(b) || a.id.localeCompare(b.id));

  const banter = new Map();
  const fromPool = [];
  for (const { id, sections } of questions) {
    if (sections?.introFun && sections?.punchlineFun) {
      banter.set(id, { intro: sections.introFun, punchline: sections.punchlineFun });
    } else {
      fromPool.push(id);
    }
  }
  for (const [id, lines] of assignBanter(fromPool)) banter.set(id, lines);
  return banter;
}

/**
 * One open question, set apart: a horizontal rule, a heading naming its number and rank, its intro
 * in italics, the question quoted, its punchline in italics (PRD #50 s2), then its options table
 * with A recommended and built and the reply line — or, for a `human-action` item, the steps a
 * person must take. An item raised before options existed keeps its decision and the older `ok` /
 * `no, because …` reply line. Pure.
 */
function openQuestionLines(item, number, round, banter) {
  const humanAction = item.rank === 'human-action';
  const lines = [
    '---',
    '',
    `### Question ${number} · ${item.rank} — ${humanAction ? 'needs a person' : 'needs your decision'}`,
    '',
    funLine(banter.intro),
    '',
    quoted(item.sections.questionPlain),
    '',
    funLine(banter.punchline),
    '',
  ];

  if (humanAction && item.sections.personSteps) {
    lines.push(
      '**What a person must do:**',
      '',
      item.sections.personSteps.trim(),
      '',
      `Reply \`${number}: ok\` once it is done, or \`${number}: no, because …\``,
    );
  } else if (hasOptions(item)) {
    const { options } = item.sections;
    lines.push(
      ...formatOptionsTable(options, 'recommended · built'),
      '',
      `Reply \`${number}: A\`, \`${number}: ${otherLetter(options)} because …\`, or ` +
        '`go with recommendation`',
    );
  } else {
    lines.push(
      `**Decision taken:** ${item.sections.decisionPlain}`,
      '',
      `Reply \`${number}: ok\` to keep it, or \`${number}: no, because …\``,
    );
  }

  if (round) lines.push('', `_Asked again in round ${round}._`);
  lines.push('');
  return lines;
}

/**
 * The item an adopted settled entry embeds, parsed — `null` when it cannot be read, so a damaged
 * entry is left off rather than crashing the comment (the same stance `openItemsForPrd` takes).
 */
function adoptedItem(entry) {
  const parsed = parseOutboxItem(entry.itemText, { file: null });
  return parsed.ok ? parsed.item : null;
}

/**
 * One adopted question, inside the collapsed section: heading, its intro in italics, the question
 * quoted, its punchline in italics (PRD #50 s2), its options with A adopted and built, and the one
 * line that says how to object. Pure.
 */
function adoptedQuestionLines(entry, number, round, banter) {
  const item = adoptedItem(entry);
  const question = item?.sections.questionPlain ?? answeredQuestionText(entry);
  const options = item && hasOptions(item) ? item.sections.options : [];
  const lines = [
    `### Question ${number} · medium — adopted`,
    '',
    funLine(banter.intro),
    '',
    quoted(question),
    '',
    funLine(banter.punchline),
    '',
  ];
  if (options.length > 0) {
    lines.push(
      ...formatOptionsTable(options, 'adopted · built'),
      '',
      `To object, reply \`${number}: ${otherLetter(options)} because …\``,
    );
  } else {
    if (item?.sections.decisionPlain) {
      lines.push(`**Decision taken:** ${item.sections.decisionPlain}`, '');
    }
    lines.push(`To object, reply \`${number}: no, because …\``);
  }
  if (round) lines.push('', `_Asked again in round ${round}._`);
  lines.push('');
  return lines;
}

/**
 * The pull request comment body (PRD #1071 s2, laid out by PRD #1166 s6): the pull-request marker on
 * its own first line, then — when any item is still open — a header naming how many questions need a
 * decision and how to reply (`2: A`, `2: B because …`, or `go with recommendation` for every one at
 * once), and a note that a reply settles nothing until `/omni:yolo-fix` runs. Then every open
 * question worst-first (`human-action`, then `high`), each set apart by a horizontal rule under its
 * permanent `number` (see {@link openQuestionLines}), followed by "asked again in round N" when
 * {@link parseRoundMarkers} names that number. Then, when `adopted` is non-empty, the collapsed
 * **Adopted unless you object** section: every adopted medium item, numbered like any question, its
 * options with A adopted and built, and the line saying how to object. Every open and every adopted
 * question carries an intro under its heading and a punchline after its question (PRD #50 s2), its
 * item's own or the kit's pool's (see {@link questionBanter}). With nothing open, the header
 * reads "Nothing needs your decision" when something is adopted, "Every question is answered" when
 * something is only answered, and "No open items." otherwise. Then, when `answered` is non-empty, an
 * **Answered** section: each settled entry's question, the reply quoted, who gave it, when, and the
 * outcome. Finally the hidden numbering marker, always present. Pure — no GitHub call, no filesystem
 * access.
 *
 * @param {{ items: object[], adopted?: object[], answered?: object[], numbering: { number: number, id: string, since: string }[], roundMarkers?: Map<number, number>, ctx: object }} args
 */
export function formatOutboxPrComment({
  items,
  adopted = [],
  answered = [],
  numbering,
  roundMarkers = new Map(),
  ctx,
}) {
  const sorted = sortItems(items);
  const numberById = new Map(numbering.map((entry) => [entry.id, entry.number]));
  const byNumber = (a, b) => (numberById.get(a.id) ?? 0) - (numberById.get(b.id) ?? 0);
  const banter = questionBanter({ items: sorted, adopted, numberById });
  const lines = [ctx.markers.prComment, ''];

  if (sorted.length > 0) {
    const count = sorted.length;
    const example = numberById.get(sorted.at(-1).id) ?? 1;
    lines.push(
      `**${count} question${count === 1 ? '' : 's'} need${count === 1 ? 's' : ''} your decision**`,
      '',
      `Reply to this comment, one line per question: \`${example}: A\` keeps what was built, ` +
        `\`${example}: B because …\` chooses another option. Several answers can go in one reply. ` +
        'To keep every recommendation at once, reply `go with recommendation`.',
      '',
      `_A reply settles nothing on its own — \`${COMMANDS.yoloFix}\` reads the replies and settles ` +
        'them._',
      '',
    );
    for (const item of sorted) {
      const number = numberById.get(item.id);
      lines.push(...openQuestionLines(item, number, roundMarkers.get(number), banter.get(item.id)));
    }
  } else if (adopted.length > 0) {
    lines.push('**Nothing needs your decision**', '');
  } else if (answered.length > 0) {
    lines.push('**Every question is answered**', '');
  } else {
    lines.push('No open items.', '');
  }

  if (adopted.length > 0) {
    lines.push(
      '---',
      '',
      `<details><summary>Adopted unless you object · ${adopted.length} medium</summary>`,
      '',
    );
    for (const entry of [...adopted].sort(byNumber)) {
      const number = numberById.get(entry.id);
      lines.push(
        ...adoptedQuestionLines(entry, number, roundMarkers.get(number), banter.get(entry.id)),
      );
    }
    lines.push('</details>', '');
  }

  if (answered.length > 0) {
    lines.push('**Answered**', '');
    for (const entry of [...answered].sort(byNumber)) {
      const number = numberById.get(entry.id);
      const question = answeredQuestionText(entry);
      lines.push(`**Question ${number}**`, '');
      if (question) lines.push(question, '');
      lines.push(
        `Reply: ${quoteReply(entry.answerText)} — @${entry.fields?.['Approved by'] ?? ''}, ` +
          `${formatApprovedAt(entry.fields?.['Approved at'])} · ${answeredOutcome(entry)}`,
        '',
      );
    }
  }

  lines.push(formatNumbersMarker(numbering, ctx.markers));

  return lines.join('\n');
}

/**
 * Writes (or rewrites) the one outbox comment on the FEATURE PULL REQUEST `client` is scoped to,
 * through `client` — the same client shape {@link upsertOutboxComment} takes (`listComments` /
 * `createComment` / `updateComment`); `kit/bin`'s production client already works unchanged, since a
 * pull request's comments are its issue's comments as far as the GitHub API is concerned. Finds the
 * existing comment by `ctx.markers.prComment`; assigns numbers to any item `previous` has not seen
 * yet ({@link assignNumbers}); reads the PRD's settled ledger and keeps only the entries a number
 * already covers ({@link answeredOutcome}'s Answered section); reads every other comment's round
 * marker ({@link parseRoundMarkers}); and renders through {@link formatOutboxPrComment}. Creates
 * only when there is something to list — an open item, or a numbered, settled one; an existing
 * comment is always rewritten, same "found, not created" rule {@link upsertOutboxComment} already
 * keeps.
 *
 * @param {{ prd: number, ctx: object, now?: () => string }} args
 * @param {{ listComments: () => Array, createComment: (body: string) => any, updateComment: (id: number, body: string) => any }} client
 * `adoptedCount` is how many adopted items the comment lists; `newAdoptedCount` how many of those
 * it numbered for the first time on this call (PRD #1166 s7) — the caller hands both, with
 * `htmlUrl`, to the PRD-issue run that writes the Slack note ({@link readPrCommentResult}).
 *
 * @returns {{ action: 'created' | 'updated' | 'skipped', id: number | null, htmlUrl: string | null, openCount: number, answeredCount: number, adoptedCount: number, newAdoptedCount: number, body: string | null }}
 */
export function upsertOutboxPrComment({ prd, ctx, now = () => new Date().toISOString() }, client) {
  const items = openItemsForPrd(prd, { ctx });
  const settledEntries = readSettledEntries(prd, { ctx });
  const comments = client.listComments();
  const existing = findPrMarkerComment(comments, ctx.markers);

  // An adopted entry is numbered like any question (PRD #1166 s6), so a reply can object to it; it
  // is a medium item, so `assignNumbers` puts it after every open human-action and high one.
  const adopted = settledEntries.filter((entry) => entry.verdict === ADOPTED_VERDICT);
  const previous = existing ? parseNumbersMarker(existing.body, ctx.markers) : [];
  const numbering = assignNumbers({
    items: [...items, ...adopted.map((entry) => ({ id: entry.id, rank: 'medium' }))],
    previous,
    now,
  });
  const numberedIds = new Set(numbering.map((entry) => entry.id));
  const answered = settledEntries.filter(
    (entry) => entry.verdict !== ADOPTED_VERDICT && numberedIds.has(entry.id),
  );

  const hasSomethingToList = items.length > 0 || adopted.length > 0 || answered.length > 0;
  if (!existing && !hasSomethingToList) {
    return {
      action: 'skipped',
      id: null,
      htmlUrl: null,
      openCount: 0,
      answeredCount: 0,
      adoptedCount: 0,
      newAdoptedCount: 0,
      body: null,
    };
  }

  // PRD #1166 s7: an adopted item this comment numbers for the first time is news for the Slack
  // note — the numbering marker is the one durable record of what this comment has ever shown.
  const previouslyNumbered = new Set(previous.map((entry) => entry.id));
  const counted = {
    openCount: items.length,
    answeredCount: answered.length,
    adoptedCount: adopted.length,
    newAdoptedCount: adopted.filter((entry) => !previouslyNumbered.has(entry.id)).length,
  };

  const roundMarkers = parseRoundMarkers(
    comments.filter((comment) => comment.id !== existing?.id),
    ctx.markers,
  );
  const body = formatOutboxPrComment({ items, adopted, answered, numbering, roundMarkers, ctx });

  if (existing) {
    const updated = client.updateComment(existing.id, body);
    return {
      action: 'updated',
      id: existing.id,
      htmlUrl: updated?.html_url ?? existing.html_url ?? null,
      ...counted,
      body,
    };
  }

  const created = client.createComment(body);
  return {
    action: 'created',
    id: created?.id ?? null,
    htmlUrl: created?.html_url ?? null,
    ...counted,
    body,
  };
}

/** Open items tallied by rank, e.g. `{ high: 1, medium: 2 }` — a rank with no open item is left off
 * rather than reported as zero, so `slackLine` never has to filter it back out. Pure. */
export function countsByRank(items) {
  const counts = {};
  for (const item of items) {
    counts[item.rank] = (counts[item.rank] ?? 0) + 1;
  }
  return counts;
}

/** Escapes the three characters Slack's mrkdwn reads as markup — `&`, `<`, `>` — so a PRD title or a
 * handle can never open a link, a mention or a `<!channel>` of its own. */
function slackEscape(text) {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/** `count word`, with the noun's plural when `count` is not one. */
function plural(count, singular, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** A Slack user id is `U…` or `W…` followed by upper-case letters and digits — anything else, a
 * lookup's `null`, an error string, a `<!channel>`, is never written as a mention. */
const SLACK_USER_ID = /^[UW][A-Z0-9]{2,}$/;

/**
 * Who the Slack note names (PRD #1166 s7): a mention when the caller's own Slack lookup found a
 * user, the GitHub handle when it did not, nobody when neither is known. The lookup itself lives in
 * the caller — this only decides which of its answers to trust. Pure.
 *
 * @param {{ slackId?: string | null, login?: string | null }} args
 * @returns {{ slackId: string } | { login: string } | null}
 */
export function slackOwner({ slackId, login } = {}) {
  if (typeof slackId === 'string' && SLACK_USER_ID.test(slackId)) return { slackId };
  if (typeof login === 'string' && login.trim() !== '') return { login: login.trim() };
  return null;
}

/** The owner as Slack text: `<@U…>` pings them; `@login` is plain text Slack leaves alone. */
function ownerText(owner) {
  if (owner?.slackId) return `<@${owner.slackId}>`;
  if (owner?.login) return `@${slackEscape(owner.login)}`;
  return null;
}

/** The link's words: the pull request's number when the url is its outbox comment, otherwise the
 * PRD issue — the url is the only thing that says which one it is. */
function linkLabel(url) {
  const pull = url.match(/\/pull\/(\d+)/);
  return pull ? `Answer on pull request #${pull[1]} →` : 'Answer on the PRD issue →';
}

/**
 * The Slack note's text (PRD #1057 s1, rewritten by PRD #1166 s7), in Slack mrkdwn, three lines:
 *
 *   *PRD #778 · Quote line components* — owner <@U123>
 *   2 questions need a decision · 4 adopted unless someone objects · 1 unaccounted change
 *   <url|Answer on pull request #1120 →>
 *
 * The title is the PRD issue's own, a leading `PRD:` stripped. The owner is `{ slackId }` (a
 * mention) or `{ login }` (the GitHub handle, plain text) — {@link slackOwner} picks; with neither,
 * the owner is left off. Every open item needs a decision — `human-action` and `high`, and a medium
 * one still sitting as an open file from before adoption existed; `adoptedCount` is the settled
 * ledger's adopted entries, never counted as waiting. A zero count is left out. The link is the
 * feature pull request's outbox comment, or the PRD-issue comment before that one exists; no url, no
 * link line. `newCount` is part of the input for {@link maybeWriteSlackNote}'s news rule and is not
 * printed. Pure — no GitHub call, no Slack call, no file write.
 *
 * @param {{ prd: number, title?: string | null, owner?: { slackId: string } | { login: string } | null, counts: Record<string, number>, adoptedCount?: number, unaccountedCount?: number, newCount?: number, url: string | null }} args
 * @returns {string}
 */
export function slackLine({
  prd,
  title,
  owner,
  counts,
  adoptedCount = 0,
  unaccountedCount = 0,
  url,
}) {
  const cleanTitle = (title ?? '').replace(/^\s*PRD:\s*/i, '').trim();
  const name = cleanTitle ? `PRD #${prd} · ${slackEscape(cleanTitle)}` : `PRD #${prd}`;
  const who = ownerText(owner);
  const head = who ? `*${name}* — owner ${who}` : `*${name}*`;

  const waiting = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const parts = [];
  if (waiting > 0) {
    parts.push(`${waiting} question${waiting === 1 ? ' needs' : 's need'} a decision`);
  }
  if (adoptedCount > 0) parts.push(`${adoptedCount} adopted unless someone objects`);
  if (unaccountedCount > 0) parts.push(plural(unaccountedCount, 'unaccounted change'));
  const tally = parts.length > 0 ? parts.join(' · ') : 'Nothing needs a decision';

  const lines = [head, tally];
  if (url) lines.push(`<${url}|${linkLabel(url)}>`);
  return lines.join('\n');
}

/**
 * What "Post the outbox pull request comment" left for the PRD-issue run (PRD #1166 s7): the
 * `--result` file's `{ htmlUrl, newAdoptedCount, … }`, or `null` when the step never wrote one — it
 * failed, it was skipped, or the file is unreadable. `null` only means the note links to the PRD
 * issue instead and knows of no newly adopted item; it never stops the note.
 *
 * @param {string | null | undefined} path
 * @param {{ read?: (path: string) => string }} [options]
 * @returns {{ htmlUrl?: string | null, newAdoptedCount?: number } | null}
 */
export function readPrCommentResult(path, { read = (file) => readFileSync(file, 'utf8') } = {}) {
  if (!path) return null;
  try {
    const parsed = JSON.parse(read(path));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Writes `slackLine`'s text to `path` through `write` — but only when the repository has opted in to
 * Slack notifications at all (`ctx.config.notify.slack` is not `null`) and there is news, and `path`
 * is given. News is the PRD-issue comment's own (`result.newCount`, PRD #1057) plus the adopted items
 * the pull request comment numbered for the first time (`prComment.newAdoptedCount`, PRD #1166 s7).
 * The link prefers the pull request comment's url and falls back to the PRD issue's. `write`
 * defaults to `writeFileSync` so a test can hand in a spy instead.
 *
 * @param {{ ctx: object, prd: number, title?: string | null, owner?: { slackId: string } | { login: string } | null, result: { counts: Record<string, number>, adoptedCount?: number, unaccountedCount: number, newCount: number, htmlUrl: string | null }, prComment?: { htmlUrl?: string | null, newAdoptedCount?: number } | null, path?: string | null, write?: typeof writeFileSync }} args
 */
export function maybeWriteSlackNote({
  ctx,
  prd,
  title = null,
  owner = null,
  result,
  prComment = null,
  path,
  write = writeFileSync,
}) {
  if (!ctx.config.notify.slack) return;
  const news = (result.newCount ?? 0) + (prComment?.newAdoptedCount ?? 0);
  if (!path || !(news > 0)) return;
  const line = slackLine({
    prd,
    title,
    owner,
    counts: result.counts,
    adoptedCount: result.adoptedCount ?? 0,
    unaccountedCount: result.unaccountedCount,
    newCount: news,
    url: prComment?.htmlUrl ?? result.htmlUrl,
  });
  write(path, `${line}\n`);
}

/**
 * Writes (or rewrites) the one outbox comment on `prd`'s issue through `client`: `listComments()`,
 * `createComment(body)`, `updateComment(id, body)`. Finds the existing comment by its marker and
 * PATCHes it in place; creates one only when something is actually listed — an open item or an
 * unaccounted change. A marker comment that already exists is always updated, even down to "nothing
 * open", because it is already the thing found and rewritten every run; there is simply nothing left
 * to create. This is exercised in `comment.test.mjs` against a fake client — no network in the
 * tests.
 *
 * `changes` (default `[]`) is the range this writer grades for unaccounted risky ground, through
 * {@link unaccountedChanges}. `ref` (default `branch`) is what item links point at — the pull
 * request's head SHA once a caller has one, falling back to the pre-existing branch-link shape.
 * `labels` (default `[]`) only matters for the wave-through line, keyed on `ctx.config.labels.
 * outboxGo`.
 *
 * `newCount` is the number of {@link announcedKeys} the new body carries that the previous marker
 * comment's body did not — every key, the first time the comment is created — read off the hidden
 * announced-keys marker via {@link parseAnnouncedMarker}, never off `itemCount`/`unaccountedCount`
 * alone, since a settled item and a newly-raised one can cancel each other out there. `htmlUrl` is
 * read off whatever `client.createComment`/`updateComment` hand back — the production client's is
 * GitHub's own `html_url` for the comment.
 *
 * @param {{ prd: number, owner: string, repo: string, branch: string, ref?: string, ctx: object, changes?: { path: string, status: string }[], labels?: string[] }} args
 * @param {{ listComments: () => Array, createComment: (body: string) => any, updateComment: (id: number, body: string) => any }} client
 * @returns {{ action: 'created' | 'updated' | 'skipped', id: number | null, htmlUrl: string | null, itemCount: number, unaccountedCount: number, newCount: number, counts: Record<string, number>, body: string }}
 */
export function upsertOutboxComment(
  { prd, owner, repo, branch, ref = branch, ctx, changes = [], labels = [] },
  client,
) {
  const items = openItemsForPrd(prd, { ctx });
  const unaccounted = unaccountedChanges(prd, changes, { ctx });
  const unreworked = unreworkedDrift(prd, { ctx });
  const body = formatOutboxComment({ prd, owner, repo, branch, ref, items, unaccounted, unreworked, labels, ctx });
  const counts = countsByRank(items);
  // PRD #1166 s7: the Slack note counts adopted items apart from the ones waiting on a decision.
  const adoptedCount = adoptedEntriesForPrd(prd, { ctx }).length;

  const existing = findMarkerComment(client.listComments(), ctx.markers);
  const hasSomethingToList = items.length > 0 || unaccounted.length > 0;

  if (!existing && !hasSomethingToList) {
    return {
      action: 'skipped',
      id: null,
      htmlUrl: null,
      itemCount: 0,
      unaccountedCount: 0,
      newCount: 0,
      counts,
      adoptedCount,
      body,
    };
  }

  const previousKeys = new Set(existing ? parseAnnouncedMarker(existing.body, ctx.markers) : []);
  const newKeys = announcedKeys({
    items: sortItems(items),
    unaccounted: sortUnaccountedChanges(unaccounted),
  });
  const newCount = newKeys.filter((key) => !previousKeys.has(key)).length;

  if (existing) {
    const updated = client.updateComment(existing.id, body);
    return {
      action: 'updated',
      id: existing.id,
      htmlUrl: updated?.html_url ?? existing.html_url ?? null,
      itemCount: items.length,
      unaccountedCount: unaccounted.length,
      newCount,
      counts,
      adoptedCount,
      body,
    };
  }

  const created = client.createComment(body);
  return {
    action: 'created',
    id: created?.id ?? null,
    htmlUrl: created?.html_url ?? null,
    itemCount: items.length,
    unaccountedCount: unaccounted.length,
    newCount,
    counts,
    adoptedCount,
    body,
  };
}
