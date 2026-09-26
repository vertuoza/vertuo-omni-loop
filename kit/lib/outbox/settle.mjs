/**
 * **A settled item keeps its question, and says whether the build drifted** (PRD #985, slice s5).
 *
 * Settling takes one open outbox item and a human's answer — given on the PRD issue or on the
 * feature pull request, whichever carries it — and produces the settled entry: the question
 * preserved **verbatim**, plus who approved it, when, which channel the answer came from, and a
 * verdict. The open file is deleted in the same breath, so a caller commits the append and the
 * deletion together.
 *
 * Two rules the rest of this file exists to keep:
 *
 * 1. **The question is never rewritten to match the answer.** The entry embeds the item file's
 *    whole text, byte for byte, inside a fence — including its front matter and all four sections,
 *    so slice s9 can still read *What it costs to change later* off a drifted entry and derive a
 *    rework from it.
 * 2. **`settled.md` is appended, never rewritten.** Nothing here reads an existing entry to change
 *    it; the ledger only ever grows.
 *
 * **Why `text` and not `markdown` on the fences.** Prettier formats embedded code in a markdown
 * fence whose language it recognises — `markdown` included. A settled entry that Prettier is free
 * to reflow is not verbatim any more, so both fences are tagged `text`, which Prettier leaves
 * alone.
 *
 * The verdict is the other half, and {@link judgeAnswer} is deliberately a **pure, small,
 * over-eager** comparison. See "What the comparison cannot do" on that function, and the outbox
 * dir's own `README.md` (rendered by {@link settledHeader}), for what it honestly cannot
 * determine — no model decides whether an answer contradicts a choice, and this function does not
 * pretend to read prose.
 *
 * **A medium item is adopted, not settled by a human** (PRD #1166, slice s5, Durable decision "The
 * `adopted` verdict"). A slice that records a `medium` item writes it straight here, through
 * {@link adoptItem} — never as an open item file — with `Verdict: adopted`, `Approved by: nobody`
 * and `Approved at:` the date it was raised. `adopted` counts as settled-and-kept everywhere
 * `agreed` does. The ledger stays append-only: an objection to an adopted item appends a `drifted`
 * entry for the SAME id rather than editing the adopted one, so {@link parseSettledEntries} returns
 * only the **latest** entry for any id it finds more than once — the one rule every reader of the
 * ledger gets for free, in this one place, rather than in each of them.
 */
// Ported from vertuo-ai-domain@c4a210122:scripts/outbox-settle.mjs — changes in kit/porting/outbox--settle.md.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative } from 'node:path';
import { z } from 'zod';
import { COMMANDS } from '../commands.mjs';
import { SETTLED_FILE, parseOutboxItem } from './outbox.mjs';

/**
 * The two verdicts a HUMAN's answer produces, through {@link judgeAnswer}. Named by the plan; no
 * slice renames them. `adopted` (below) is deliberately not in this list: nobody answers an adopted
 * item, so `AnswerSchema`'s `statedVerdict` — and `--verdict` on the CLI — still only ever accepts
 * one of these two.
 */
export const VERDICTS = /** @type {const} */ (['agreed', 'drifted']);

/**
 * The verdict a `medium` item gets the moment it is raised (PRD #1166, slice s5) — settled, kept,
 * and never asked about, unless an objection later appends a `drifted` entry for the same id.
 */
export const ADOPTED_VERDICT = 'adopted';

/** The answer text an adopted entry carries — nobody actually answered anything. */
const ADOPTED_ANSWER_TEXT =
  'Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.';

/**
 * The two answer channels. Items live on the branch; answers arrive on the PRD issue or on the
 * feature pull request, and the settled entry names the one that was used — the gate is red on the
 * pull request, and that is where you are when you notice.
 */
export const CHANNEL_KINDS = /** @type {const} */ (['prd-issue', 'feature-pull-request']);

const CHANNEL_LABEL = {
  'prd-issue': 'PRD issue',
  'feature-pull-request': 'feature pull request',
};

const AnswerChannelSchema = z
  .object({
    kind: z.enum(CHANNEL_KINDS, {
      message: `channel.kind must be one of: ${CHANNEL_KINDS.join(', ')}`,
    }),
    number: z.coerce.number({ message: 'channel.number must be a number' }).int().positive(),
    url: z.string().trim().min(1).optional(),
  })
  .strict();

/** A human's answer, as the settler needs it. Zod-first per invariant N1. */
export const AnswerSchema = z
  .object({
    text: z.string().trim().min(1, 'the answer text is required'),
    approvedBy: z.string().trim().min(1, 'approvedBy is required — who approved it'),
    approvedAt: z
      .string()
      .regex(
        /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})?)?$/,
        'approvedAt must be an ISO date or date-time',
      ),
    channel: AnswerChannelSchema,
    statedVerdict: z.enum(VERDICTS).optional(),
  })
  .strict();

/** `PRD issue #985` · `feature pull request #986` — how a human would name where they answered. */
export function channelLabel(channel) {
  return `${CHANNEL_LABEL[channel.kind] ?? channel.kind} #${channel.number}`;
}

/**
 * Markers that read as "change what you built". Matched as whole words (or whole phrases) against
 * the lowercased answer. The list is closed and short on purpose: every entry here is a word whose
 * presence in an answer to "is this right?" reads as "no".
 */
const CONTRADICTION_MARKERS = [
  'no',
  'not',
  'never',
  'cannot',
  "don't",
  "doesn't",
  "isn't",
  "shouldn't",
  "won't",
  "can't",
  'instead',
  'rather than',
  'should be',
  'should have',
  'must be',
  'change it',
  'change that',
  'change the',
  'wrong',
  'revert',
  'undo',
  'disagree',
];

/** Answers whose opening clause is one of these, and which carry no contradiction marker. */
const AFFIRMATIONS = new Set([
  'yes',
  'ok',
  'okay',
  'agreed',
  'agree',
  'confirmed',
  'confirm',
  'correct',
  'right',
  'fine',
  'lgtm',
  'looks good',
  'good',
  'sounds good',
  'keep it',
  'keep it as is',
  'go ahead',
  'approved',
  'ship it',
  'that is right',
  'thats right',
]);

const STATED_VERDICT_LINE = /^[ \t]*verdict:[ \t]*(agreed|drifted)[ \t]*$/im;

function normalizeApostrophes(text) {
  return text.replace(/[‘’ʼ]/g, "'");
}

/** Lowercased, apostrophes normalized, whitespace collapsed — for the verbatim-restatement test. */
function normalizeWhole(text) {
  return normalizeApostrophes(text).toLowerCase().replace(/\s+/g, ' ').trim();
}

/** The answer's opening clause, reduced to bare words — for the affirmation test. */
function openingClause(text) {
  const [first] = normalizeApostrophes(text).split(/[,.;:!?\n]|—|–|--/);
  return (first ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function markerFound(haystack, marker) {
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9'])${escaped}([^a-z0-9']|$)`).test(haystack);
}

/**
 * Compares a human's answer against the choice the agent recorded (*What I did meanwhile*) and
 * returns `{ verdict, basis, reason }` — `verdict` is `'agreed'`, `'drifted'`, or `null` when the
 * comparison cannot tell.
 *
 * **Pure.** No filesystem, no network, and — by design — no model. The rules run in this order, and
 * the first that fires wins:
 *
 * 1. `stated` — the caller passed a verdict, or the answer carries a `Verdict: agreed|drifted`
 *    line. A human who says which it is is always believed.
 * 2. `restates-the-choice` — the answer repeats the recorded choice word for word (whitespace and
 *    case aside). Repeating a choice back is agreeing with it.
 * 3. `contradiction-marker` — the answer carries one of {@link CONTRADICTION_MARKERS}.
 * 4. `affirmation` — the answer's opening clause is a plain yes, and no marker fired.
 * 5. `undetermined` — none of the above. The settler then **refuses to settle** rather than guess.
 *
 * **Why contradiction is read before affirmation.** "Yes, but it should be X instead" is a
 * contradiction wearing a yes. A wrong `drifted` costs a rework question; a wrong `agreed` ships a
 * build nobody approved.
 *
 * **What the comparison cannot do.** It does not understand the answer. It cannot tell that "use
 * the contact's country" contradicts "use the tenant's country" when the sentence carries no
 * marker; it cannot tell that "there is not much risk either way" is an agreement despite carrying
 * `not`. It is over-eager towards `drifted` on purpose, and it says `undetermined` rather than
 * inventing a reading. A `Verdict:` line in the answer overrides it in one move, and that is the
 * lever a human has when it reads their sentence the wrong way.
 */
export function judgeAnswer({ choice, answer, statedVerdict = null }) {
  const stated = statedVerdict ?? answer.match(STATED_VERDICT_LINE)?.[1]?.toLowerCase() ?? null;
  if (stated) {
    return {
      verdict: stated,
      basis: 'stated',
      reason: `the answer is settled as "${stated}" because a human said so, not because a comparison read it`,
    };
  }

  if (choice && normalizeWhole(answer) === normalizeWhole(choice)) {
    return {
      verdict: 'agreed',
      basis: 'restates-the-choice',
      reason: 'the answer repeats the recorded choice word for word',
    };
  }

  const haystack = normalizeWhole(answer);
  const found = CONTRADICTION_MARKERS.filter((marker) => markerFound(haystack, marker));
  if (found.length > 0) {
    return {
      verdict: 'drifted',
      basis: 'contradiction-marker',
      reason: `the answer says ${found.map((marker) => `"${marker}"`).join(', ')}, which reads as a change to the recorded choice`,
    };
  }

  const opening = openingClause(answer);
  if (AFFIRMATIONS.has(opening)) {
    return {
      verdict: 'agreed',
      basis: 'affirmation',
      reason: `the answer opens with "${opening}" and carries no contradiction marker`,
    };
  }

  return {
    verdict: null,
    basis: 'undetermined',
    reason:
      'the comparison found neither a restatement, a contradiction marker, nor a plain affirmation — it does not read prose, so it refuses to guess',
  };
}

/** A backtick fence longer than any run of backticks inside `content`, so the fence always closes. */
function fenceFor(content) {
  const longest = Math.max(0, ...[...content.matchAll(/`+/g)].map((match) => match[0].length));
  return '`'.repeat(Math.max(3, longest + 1));
}

/**
 * One verbatim block. A single `\n` always separates the content from the closing fence, and
 * {@link parseSettledEntries} strips exactly that one newline back off — so content that ends with
 * a newline and content that does not both round-trip byte for byte.
 */
function verbatimBlock(content) {
  const fence = fenceFor(content);
  return `${fence}text\n${content}\n${fence}`;
}

function closedLine(verdict) {
  if (verdict === 'agreed') {
    return 'yes — the answer matches what was built, so there is nothing to rework';
  }
  if (verdict === ADOPTED_VERDICT) {
    return 'yes — adopted when it was raised; nothing to rework unless someone objects';
  }
  return `no — the build and the decision disagree until a rework sub-PR brings them back in line (${COMMANDS.yoloFix})`;
}

/** The header a fresh `settled.md` starts with. Written once; every settling after this appends. */
export function settledHeader(prd, { ctx }) {
  return [
    `# Settled outbox items — PRD ${prd}`,
    '',
    'Append-only. Each entry below is one outbox item a human answered: the question exactly as it',
    'was raised, the answer exactly as it was given, who approved it, when, through which channel,',
    `and the verdict. Nothing here is ever rewritten — see \`${ctx.config.paths.delivery}/README.md\`.`,
    '',
  ].join('\n');
}

/**
 * Renders one settled entry. Pure: item text in, markdown out.
 *
 * `answer.channel` is `null` for an adopted entry — nobody answered it on either channel, so
 * neither `- Channel:` nor `- Channel URL:` is written at all, rather than naming a channel that
 * was never used.
 *
 * `closed`, when given, is the `Closed:` line's text as written (PRD #82, slice s2: a merge over a
 * red outbox closes an entry its own way). Omitted, the line follows the verdict, as it always has.
 */
export function renderSettledEntry({ item, itemText, answer, judgement, markers, closed = null }) {
  const lines = [
    markers.settledOpen(item.id),
    '',
    `## ${item.id} — ${judgement.verdict}`,
    '',
    `- Verdict: ${judgement.verdict}`,
    `- Approved by: ${answer.approvedBy}`,
    `- Approved at: ${answer.approvedAt}`,
  ];
  if (answer.channel) {
    lines.push(`- Channel: ${channelLabel(answer.channel)}`);
    if (answer.channel.url) lines.push(`- Channel URL: ${answer.channel.url}`);
  }
  lines.push(
    `- Basis: ${judgement.basis} — ${judgement.reason}`,
    `- Closed: ${closed ?? closedLine(judgement.verdict)}`,
    `- Rank: ${item.rank}`,
    `- Bears on: ${item.bearsOn}`,
    `- Raised: ${item.raised}`,
    `- Slice: ${item.slice}`,
    `- Wave: ${item.wave}`,
    '',
    '### The answer, as it was given',
    '',
    verbatimBlock(answer.text),
    '',
    '### The item, as it was raised',
    '',
    verbatimBlock(itemText),
    '',
    markers.settledClose(item.id),
    '',
  );
  return lines.join('\n');
}

/**
 * Reads a `settled.md` back into entries — `{ id, verdict, closed, fields, answerText, itemText,
 * became }`, **the latest one for any id the file holds more than once** (PRD #1166, slice s5).
 * The ledger is append-only, so an objection to an already-`adopted` item appends a fresh `drifted`
 * entry under the SAME id rather than editing the first one — this is the one place that later
 * entry wins, so every caller of this function (this module's own callers, an outbox comment's
 * Answered section, a rework step's drifted-entry search) gets "latest wins" for free, with
 * nothing to change in any of them. Pure. A later slice reads the drifted entries through this;
 * the tests prove the item text it returns is byte-identical to the file that was settled.
 */
export function parseSettledEntries(text, markers) {
  return latestPerId(rawSettledEntries(text, markers));
}

/** Keeps, for each id, only the entry that appears LAST in `entries` — the append-only ledger's
 * "latest wins" rule. A repeated id keeps its first position (so unrelated ids keep reading in
 * raised order) with the later entry's own facts. */
function latestPerId(entries) {
  const byId = new Map();
  for (const entry of entries) byId.set(entry.id, entry);
  return [...byId.values()];
}

/** Every entry `settled.md` carries, in file order, with no dedup — {@link parseSettledEntries}'s
 * one caller. */
function rawSettledEntries(text, markers) {
  const lines = text.split('\n');
  const entries = [];
  let current = null;

  for (let index = 0; index < lines.length; index += 1) {
    const openMatch = lines[index].match(markers.settledOpenRe);
    if (openMatch) {
      current = { id: openMatch[1], fields: {}, blocks: [] };
      continue;
    }
    if (!current) continue;

    if (lines[index] === markers.settledClose(current.id)) {
      const [answerText = '', itemText = ''] = current.blocks;
      const closed = /^yes\b/.test(current.fields.Closed ?? '');
      const became = (current.fields.Became ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
      entries.push({
        id: current.id,
        verdict: current.fields.Verdict,
        closed,
        fields: current.fields,
        answerText,
        itemText,
        became,
      });
      current = null;
      continue;
    }

    const fenceMatch = lines[index].match(/^(`{3,})text$/);
    if (fenceMatch) {
      const fence = fenceMatch[1];
      const start = index + 1;
      let end = start;
      while (end < lines.length && lines[end] !== fence) end += 1;
      // The renderer always writes one `\n` between the content and the closing fence; that newline
      // is the line terminator of the last content line, so joining the lines between the fences
      // gives the content back byte for byte — with or without a trailing newline of its own.
      current.blocks.push(lines.slice(start, end).join('\n'));
      index = end;
      continue;
    }

    const fieldMatch = lines[index].match(/^- ([A-Za-z][A-Za-z ]*): (.*)$/);
    if (fieldMatch) current.fields[fieldMatch[1]] = fieldMatch[2];
  }

  return entries;
}

/** Accepts either a repo-relative path (what a skill passes) or an absolute one (what a human types). */
function locate(root, file) {
  const absoluteFile = isAbsolute(file) ? file : join(root, file);
  return { absoluteFile, relativeFile: relative(root, absoluteFile) };
}

/**
 * Settles one open item: reads it, judges the answer against the recorded choice, appends the
 * settled entry to the item's PRD's outbox directory `settled.md`, and deletes the open file.
 * Nothing is written unless every step holds — a malformed item, an ill-formed answer, an
 * undetermined verdict, or a PRD with no inbox or shipped folder leaves the tree exactly as it
 * was.
 *
 * @returns {{ ok: true, verdict, basis, entry, settledFile, removedFile }
 *   | { ok: false, errors: string[] }}
 */
export function settleItem({ ctx, file, answer }) {
  const { absoluteFile, relativeFile } = locate(ctx.root, file);

  const parsedAnswer = AnswerSchema.safeParse(answer);
  if (!parsedAnswer.success) {
    return {
      ok: false,
      errors: parsedAnswer.error.issues.map(
        (issue) => `${issue.path.join('.') || '(answer)'}: ${issue.message}`,
      ),
    };
  }

  if (!existsSync(absoluteFile)) {
    return { ok: false, errors: [`${relativeFile}: no such open item.`] };
  }

  const itemText = readFileSync(absoluteFile, 'utf8');
  const parsedItem = parseOutboxItem(itemText, { file: relativeFile });
  if (!parsedItem.ok) return { ok: false, errors: parsedItem.errors };

  const { item } = parsedItem;
  const outboxDir = ctx.layout.outboxDir(item.prd);
  if (outboxDir === null) throw new Error(`PRD ${item.prd} has no inbox or shipped folder`);

  const judgement = judgeAnswer({
    choice: item.sections.whatIDidMeanwhile,
    answer: parsedAnswer.data.text,
    statedVerdict: parsedAnswer.data.statedVerdict ?? null,
  });

  if (judgement.verdict === null) {
    return {
      ok: false,
      errors: [
        `${relativeFile}: the verdict is undetermined — ${judgement.reason}. Say it outright: add a "Verdict: agreed" or "Verdict: drifted" line to the answer, or pass --verdict.`,
      ],
    };
  }

  const settledFile = `${outboxDir}/${SETTLED_FILE}`;
  const absoluteSettled = join(ctx.root, settledFile);
  const existing = existsSync(absoluteSettled)
    ? readFileSync(absoluteSettled, 'utf8')
    : settledHeader(item.prd, { ctx });
  const separator = existing.endsWith('\n') ? '\n' : '\n\n';
  const entry = renderSettledEntry({
    item,
    itemText,
    answer: parsedAnswer.data,
    judgement,
    markers: ctx.markers,
  });

  // Append, never rewrite: `existing` goes out first, untouched, and the entry follows it.
  writeFileSync(absoluteSettled, `${existing}${separator}${entry}`);
  rmSync(absoluteFile);

  return {
    ok: true,
    verdict: judgement.verdict,
    basis: judgement.basis,
    entry,
    settledFile,
    removedFile: relativeFile,
  };
}

/**
 * The judgement an adopted entry carries — never through {@link judgeAnswer}, since nobody answered
 * anything; a medium item is adopted the moment it is raised.
 */
function adoptedJudgement() {
  return {
    verdict: ADOPTED_VERDICT,
    basis: 'adopted-when-raised',
    reason:
      'a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects',
  };
}

/**
 * Renders the settled entry for a medium item adopted at raise time: `Verdict: adopted`,
 * `Approved by: nobody`, `Approved at:` the date the item itself was raised, and no channel —
 * nobody answered it on either one (PRD #1166, slice s5). Pure: item and its raw text in, entry
 * markdown out.
 *
 * @param {{ item: object, itemText: string, markers: object }} input
 */
export function renderAdoptedEntry({ item, itemText, markers }) {
  return renderSettledEntry({
    item,
    itemText,
    answer: {
      approvedBy: 'nobody',
      approvedAt: item.raised,
      channel: null,
      text: ADOPTED_ANSWER_TEXT,
    },
    judgement: adoptedJudgement(),
    markers,
  });
}

/**
 * Adopts one `medium` item at raise time: appends its settled entry (`Verdict: adopted`) to the
 * item's PRD's outbox directory `settled.md`. Unlike {@link settleItem}, this reads no open item
 * file and deletes none — a medium item is never written as one in the first place (PRD #1166,
 * slice s5, Durable decision "The `adopted` verdict"). The caller hands in the item's own rendered
 * text (an outbox item renderer's output, or an existing open item's text when migrating one that
 * predates this slice); nothing here touches disk beyond `settled.md` itself.
 *
 * Refuses an item that fails to parse, or one whose rank is not `medium` — anything else still gets
 * an open item file the ordinary way, and this function is not how it is settled.
 *
 * @param {{ ctx: object, itemText: string }} input
 * @returns {{ ok: true, entry: string, settledFile: string, item: object }
 *   | { ok: false, errors: string[] }}
 */
export function adoptItem({ ctx, itemText }) {
  const parsedItem = parseOutboxItem(itemText, { file: null });
  if (!parsedItem.ok) return { ok: false, errors: parsedItem.errors };

  const { item } = parsedItem;
  if (item.rank !== 'medium') {
    return {
      ok: false,
      errors: [
        `${item.id}: only a "medium" item is adopted at raise time — this one is ranked "${item.rank}" and is written as an open item file instead.`,
      ],
    };
  }

  const outboxDir = ctx.layout.outboxDir(item.prd);
  if (outboxDir === null) throw new Error(`PRD ${item.prd} has no inbox or shipped folder`);

  const settledFile = `${outboxDir}/${SETTLED_FILE}`;
  const absoluteSettled = join(ctx.root, settledFile);
  const existing = existsSync(absoluteSettled)
    ? readFileSync(absoluteSettled, 'utf8')
    : settledHeader(item.prd, { ctx });
  const separator = existing.endsWith('\n') ? '\n' : '\n\n';
  const entry = renderAdoptedEntry({ item, itemText, markers: ctx.markers });

  // Append, never rewrite — the same discipline `settleItem` keeps, minus the open-file deletion:
  // there is no open file to delete. A medium item is adopted without ever having had an open file
  // (or even its PRD directory) written first, so the directory needs creating here.
  mkdirSync(dirname(absoluteSettled), { recursive: true });
  writeFileSync(absoluteSettled, `${existing}${separator}${entry}`);

  return { ok: true, entry, settledFile, item };
}
