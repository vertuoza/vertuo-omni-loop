/**
 * **Replies on the feature pull request become settlements** (PRD #1071, slice s3).
 *
 * The pull request comment asks every open question under a permanent number. This reader turns
 * the answers people leave under it into settled entries:
 *
 * 1. It lists the pull request's comments and keeps only the **writers'** — `author_association`
 *    `OWNER`, `MEMBER` or `COLLABORATOR` — that carry **no** outbox marker (the configured marker
 *    prefix, `markers.any`), so the question comment and the round comments, which hold reply-shaped
 *    lines themselves, are never read as answers.
 * 2. It reads each kept comment line by line: `<n>: <answer>` answers question `n`; a line that is
 *    exactly `approve all` agrees with every question listed before that comment was written. Every
 *    other line is ignored, and so is a number that names no open question.
 * 3. **Precedence**, per question: a numbered answer beats `approve all`, whichever came first; of
 *    two numbered answers the later wins.
 * 4. The answer is judged by `settle.mjs`'s `judgeAnswer`, unchanged (`approve all` is a stated
 *    `agreed`), and a decided one is settled through `settleItem` with channel
 *    `feature-pull-request` — the same append-and-delete every other channel uses; the caller
 *    commits the two together.
 * 5. An **undetermined** answer settles nothing. It is held for a round, and a round is **due** for
 *    it only when its answer is newer than the last round comment that re-asked it — so running this
 *    twice with no new reply settles nothing and posts nothing.
 *
 * **Options, the recommendation, and objections.** Every question now offers lettered options, A
 * the one built. `go with recommendation` is a synonym of `approve all` (same precedence, same
 * "only what was listed before" rule); `<n>: A` and `<n>: go with recommendation` agree; `<n>:
 * <another offered letter>`, with or without `because …`, drifts, and the settled answer records
 * `<letter>. <option text> — because <reason>` so `/omni:yolo-fix` knows what to rework towards; a
 * letter the question does not offer is not an answer and is asked again in a round
 * ({@link interpretAnswer}). An **adopted** medium item is numbered on the comment too: a numbered
 * answer that agrees changes nothing, and one that disagrees appends a `drifted` entry for the same
 * id ({@link appendObjection}) — the ledger stays append-only, and its latest entry wins.
 *
 * {@link planReplies} is the pure core (comments + numbering + open items in, a plan out, no disk,
 * no network); {@link readReplies} applies the plan against a context and an injected GitHub client
 * (`listComments` / `createComment` / `updateComment`) — this module does no network I/O and never
 * shells out to `gh` itself.
 */
// Ported from vertuo-ai-domain@c4a210122:scripts/outbox-replies.mjs — changes in kit/porting/outbox--replies.md.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  adoptedEntriesForPrd,
  findPrMarkerComment,
  openItemsForPrd,
  parseNumbersMarker,
  parseRoundMarkers,
} from './comment.ts';
import type { Context } from '../context.ts';
import type { OutboxItem, OutboxOption } from '../types.ts';
import { AnswerSchema, judgeAnswer, parseItem, renderSettledEntry, settleItem } from './settle.ts';
import type { Judgement, Markers, SettledItemFacts, SettledVerdict, Verdict } from './settle.ts';
import { SETTLED_FILE } from './outbox.ts';

/** A pull request comment, as GitHub lists it: only the fields the reader looks at. */
type ReplyComment = {
  id: number;
  body?: string | null;
  created_at?: string;
  user?: { login?: string } | null;
  author_association?: string;
  html_url?: string;
};

/** An adopted settled entry, as far as the reader needs it: its id and its item's text. */
type AdoptedEntry = { id: string; itemText: string };

/** One reply line: a numbered answer, or an `approve all` (`go with recommendation`). */
type ReplyLine = { kind: 'numbered'; number: number; text: string } | { kind: 'approve-all'; text: string };

/** How a numbered answer reads against the options its question offers. */
type Reading =
  | { statedVerdict: Verdict | null; recorded: string; undetermined?: undefined }
  | { undetermined: true; recorded: string; statedVerdict?: undefined };

/** A question a reply may answer: its numbering entry, its item, and its adopted entry when it has one. */
type Question = { number: number; id: string; since: string; item: OutboxItem; adoptedEntry: AdoptedEntry | null };

/** A reply's answer to one question, before and after it is read. */
type RawAnswer = { approvedBy: string; approvedAt: string | undefined; url: string | undefined; text: string; approveAll?: boolean };
type ReadAnswer = RawAnswer & { recorded: string; statedVerdict?: Verdict };

/** A question asked again in a round. */
type RoundQuestion = { number: number; rank: string; questionPlain: string; answerText: string };

/** The `author_association` values whose replies count: people who can write to the repository. */
export const WRITER_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);

const NUMBERED_LINE = /^\s*(\d+)\s*:\s*(.+)$/;
const APPROVE_ALL_LINE = /^\s*approve all\s*$/i;
/** `go with recommendation` — a synonym of `approve all`; "the" is tolerated. */
const RECOMMENDATION_RE = /^\s*go with (?:the )?recommendation[\s.!]*$/i;

/** The recorded answer text for an `approve all` line, whatever case it was typed in. */
export const APPROVE_ALL_TEXT = 'approve all';

/** The recorded answer text for a `go with recommendation` line, whatever case it was typed in. */
export const RECOMMENDATION_TEXT = 'go with recommendation';

/**
 * A reply that names one option by its letter: the letter alone, or followed by a reason —
 * `B`, `b because …`, `B, because …`, `B: because …`, `B. because …`. A letter directly followed by
 * more letters (`ok`, `no, because …`) is prose, never an option.
 */
const LETTER_ANSWER = /^([A-Za-z])(?:\s*[.,:;)\-—–]?\s*because\b\s*(.*?))?[\s.!]*$/is;

/** How each rank reads in plain words — the same words the pull request comment uses. */
const RANK_PLAIN_LABEL: Record<string, string> = { 'human-action': 'needs a person', high: 'high', medium: 'medium' };

/**
 * The reply lines one comment body carries, in order. Pure.
 *
 * @param {string} body
 * `approve all` and `go with recommendation` are the same line, recorded as typed.
 *
 * @returns {Array<{ kind: 'numbered', number: number, text: string } | { kind: 'approve-all', text: string }>}
 */
export function parseReplyLines(body: unknown): ReplyLine[] {
  const lines: ReplyLine[] = [];
  for (const line of String(body ?? '').split(/\r?\n/)) {
    if (APPROVE_ALL_LINE.test(line)) {
      lines.push({ kind: 'approve-all', text: APPROVE_ALL_TEXT });
      continue;
    }
    if (RECOMMENDATION_RE.test(line)) {
      lines.push({ kind: 'approve-all', text: RECOMMENDATION_TEXT });
      continue;
    }
    const match = line.match(NUMBERED_LINE);
    if (match) lines.push({ kind: 'numbered', number: Number(match[1]), text: (match[2] ?? '').trim() });
  }
  return lines;
}

/**
 * Reads one numbered answer against the options its question offers. Pure.
 *
 * - `go with recommendation` → agreed, recorded as typed;
 * - a letter the question offers, optionally with `because …` → `A` is agreed, any other letter is
 *   drifted; either way the recorded answer is `<letter>. <option text>`, followed by
 *   ` — because <reason>` when one was given, so `/omni:yolo-fix` knows what to rework towards;
 * - a letter the question does not offer (or any letter, on a question with no options) is not an
 *   answer: `undetermined`, asked again in a round;
 * - anything else is prose, left to `judgeAnswer` (`statedVerdict: null`), recorded as written.
 *
 * @param {{ text: string, options?: { letter: string, text: string }[] }} args
 * @returns {{ statedVerdict: 'agreed' | 'drifted' | null, recorded: string } | { undetermined: true, recorded: string }}
 */
export function interpretAnswer({
  text,
  options,
}: {
  text: unknown;
  options?: readonly OutboxOption[] | undefined;
}): Reading {
  const trimmed = String(text ?? '').trim();
  if (RECOMMENDATION_RE.test(trimmed)) {
    return { statedVerdict: 'agreed', recorded: RECOMMENDATION_TEXT };
  }
  const match = trimmed.match(LETTER_ANSWER);
  if (!match) return { statedVerdict: null, recorded: trimmed };

  const letter = (match[1] ?? '').toUpperCase();
  const option = (options ?? []).find((candidate) => candidate.letter === letter);
  if (!option) return { undetermined: true, recorded: trimmed };

  const reason = (match[2] ?? '').trim();
  return {
    statedVerdict: letter === 'A' ? 'agreed' : 'drifted',
    recorded: `${letter}. ${option.text}${reason ? ` — because ${reason}` : ''}`,
  };
}

/** Whether a comment is a reply that counts: a writer's, and not one of the outbox's own. */
export function isCountedReply(comment: ReplyComment | null | undefined, markers: Pick<Markers, 'any'>): boolean {
  return (
    typeof comment?.body === 'string' &&
    !comment.body.includes(markers.any) &&
    WRITER_ASSOCIATIONS.has(comment.author_association ?? '')
  );
}

function time(iso: string | undefined): number {
  const value = Date.parse(String(iso));
  return Number.isNaN(value) ? 0 : value;
}

/** Oldest first; ties broken by id, so two comments in the same second keep GitHub's order. */
function chronological(comments: readonly ReplyComment[]): ReplyComment[] {
  return [...comments].sort((a, b) => time(a.created_at) - time(b.created_at) || a.id - b.id);
}

/**
 * The latest time each question number was re-asked by a round comment — read one comment at a
 * time, so the round marker has one parser.
 */
function lastReaskedAt(comments: readonly ReplyComment[], markers: Markers): { at: Map<number, number>; highestRound: number } {
  const at = new Map<number, number>();
  let highestRound = 0;
  for (const comment of comments) {
    const rounds = parseRoundMarkers([comment], markers);
    for (const [number, round] of rounds) {
      highestRound = Math.max(highestRound, round);
      const when = time(comment.created_at);
      const previous = at.get(number);
      if (previous === undefined || when > previous) at.set(number, when);
    }
  }
  return { at, highestRound };
}

/**
 * The questions a reply may answer, by number: every open item the numbering names, and every
 * adopted item it names, whose item is read back off its settled entry. An adopted entry whose
 * embedded item no longer parses is left out rather than guessed at.
 */
function answerableQuestions(
  numbering: readonly { number: number; id: string; since: string }[],
  items: readonly OutboxItem[],
  adopted: readonly AdoptedEntry[],
): Question[] {
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const adoptedById = new Map<string, { entry: AdoptedEntry; item: OutboxItem }>();
  for (const entry of adopted) {
    const parsed = parseItem(entry.itemText, null);
    if (parsed.ok) adoptedById.set(entry.id, { entry, item: parsed.item });
  }
  const questions: Question[] = [];
  for (const entry of numbering) {
    const open = itemsById.get(entry.id);
    const kept = adoptedById.get(entry.id);
    if (open !== undefined) {
      questions.push({ ...entry, item: open, adoptedEntry: null });
    } else if (kept !== undefined) {
      const { entry: adoptedEntry, item } = kept;
      questions.push({ ...entry, item, adoptedEntry });
    }
  }
  return questions.sort((a, b) => a.number - b.number);
}

/**
 * Decides, for every open or adopted question, what the replies say. Pure: nothing is read from
 * disk and nothing is written.
 *
 * An **adopted** question is already settled and kept: `approve all` and `go with recommendation`
 * never reach it, a numbered answer that agrees changes nothing, and one that disagrees — another
 * offered letter, or prose `judgeAnswer` reads as a change — comes back in `settle` with its
 * `adoptedEntry`, for {@link readReplies} to append a `drifted` entry for the same id. A numbered
 * answer on it that cannot be read either way is held for a round, like any other.
 *
 * @param {{ comments: Array<object>, items: Array<object>, adopted?: Array<object>, markers: object }} args
 *   every comment on the pull request, the PRD's open items, its adopted settled entries, and the
 *   configured markers.
 * @returns {{
 *   settle: Array<{ number: number, item: object, answer: object, judgement: object, adoptedEntry: object | null }>,
 *   held: Array<{ number: number, item: object, answer: object, due: boolean }>,
 *   round: { number: number, questions: Array<object> } | null,
 * }}
 */
export function planReplies(args: { comments: object[]; items: object[]; adopted?: object[]; markers: object }) {
  // The arcade passes its own loosely typed rows, so the parameters stay as wide as they were; the
  // shapes below are what the reader reads off them.
  const { comments, items, adopted = [], markers } = args as { // ts-allow: the arcade's callers pass object rows of these shapes
    comments: ReplyComment[];
    items: OutboxItem[];
    adopted?: AdoptedEntry[];
    markers: Markers;
  };
  const all: ReplyComment[] = Array.isArray(comments) ? comments : [];
  const prComment: ReplyComment | null = findPrMarkerComment(all, markers);
  const numbering: { number: number; id: string; since: string }[] = prComment ? parseNumbersMarker(prComment.body, markers) : [];
  const questions = answerableQuestions(numbering, items, adopted);
  const byNumber = new Map(questions.map((question) => [question.number, question]));
  const open = questions.filter((question) => question.adoptedEntry === null);

  // Per question: the latest numbered answer, and the latest approve-all that covers it.
  const numbered = new Map<number, RawAnswer>();
  const approved = new Map<number, RawAnswer>();
  for (const comment of chronological(all.filter((comment) => isCountedReply(comment, markers)))) {
    const answeredAt = time(comment.created_at);
    const source: Omit<RawAnswer, 'text'> = {
      approvedBy: comment.user?.login ?? '',
      approvedAt: comment.created_at,
      url: comment.html_url,
    };
    for (const line of parseReplyLines(comment.body)) {
      if (line.kind === 'numbered') {
        if (byNumber.has(line.number)) numbered.set(line.number, { ...source, text: line.text });
        continue;
      }
      for (const question of open) {
        if (time(question.since) < answeredAt) {
          approved.set(question.number, { ...source, text: line.text, approveAll: true });
        }
      }
    }
  }

  const { at: reaskedAt, highestRound } = lastReaskedAt(all, markers);
  const settle: { number: number; item: OutboxItem; answer: ReadAnswer; judgement: Judgement; adoptedEntry: AdoptedEntry | null }[] = [];
  const held: { number: number; item: OutboxItem; answer: ReadAnswer; due: boolean }[] = [];
  for (const { number, item, adoptedEntry } of questions) {
    const raw = numbered.get(number) ?? approved.get(number);
    if (!raw) continue;
    const reading: Reading = raw.approveAll
      ? { statedVerdict: 'agreed', recorded: raw.text }
      : interpretAnswer({ text: raw.text, options: item.sections?.options });
    const answer: ReadAnswer = {
      ...raw,
      recorded: reading.recorded,
      ...(reading.statedVerdict ? { statedVerdict: reading.statedVerdict } : {}),
    };
    const judgement: Judgement = reading.undetermined
      ? {
          verdict: null,
          basis: 'undetermined',
          reason: 'the reply names an option the question does not offer',
        }
      : judgeAnswer({
          choice: item.sections?.whatIDidMeanwhile,
          answer: answer.recorded,
          statedVerdict: reading.statedVerdict ?? null,
        });

    if (judgement.verdict === null) {
      const lastRound = reaskedAt.get(number);
      const due = lastRound === undefined || time(answer.approvedAt) > lastRound;
      held.push({ number, item, answer, due });
      continue;
    }
    // Agreeing with an adopted item changes nothing: it is already settled and kept.
    if (adoptedEntry && judgement.verdict !== 'drifted') continue;
    settle.push({ number, item, answer, judgement, adoptedEntry });
  }

  const dueQuestions = held.filter((question) => question.due);
  const round: { number: number; questions: RoundQuestion[] } | null =
    dueQuestions.length === 0
      ? null
      : {
          number: Math.max(highestRound, 1) + 1,
          questions: dueQuestions.map(({ number, item, answer }) => ({
            number,
            rank: item.rank,
            questionPlain: item.sections?.questionPlain ?? item.sections?.whatIHadToDecide ?? '',
            answerText: answer.text,
          })),
        };

  return { settle, held, round };
}

/**
 * The _Outbox round N_ comment: re-asks every question whose answer could not be read either way.
 * Pure. Its first line is the round marker {@link parseRoundMarkers} reads back.
 *
 * @param {{ round: number, questions: Array<{ number: number, rank: string, questionPlain: string, answerText: string }>, markers: object }} args
 */
export function formatRoundComment({
  round,
  questions,
  markers,
}: {
  round: number;
  questions: readonly RoundQuestion[];
  markers: Pick<Markers, 'round'>;
}): string {
  const ordered = [...questions].sort((a, b) => a.number - b.number);
  const lines = [
    markers.round(round, ordered.map((question) => question.number)),
    '',
    `**Outbox round ${round}**`,
    '',
  ];
  for (const question of ordered) {
    lines.push(
      `**Question ${question.number}** · ${RANK_PLAIN_LABEL[question.rank] ?? question.rank}`,
      '',
      question.questionPlain,
      '',
      `You answered: “${question.answerText}”`,
      '',
      'We could not tell whether that keeps the decision or changes it, so nothing was changed.',
      '',
      `**Are you okay? If not, why?** Reply \`${question.number}: ok\` to keep it, or \`${question.number}: no, because …\``,
      '',
    );
  }
  return lines.join('\n');
}

/**
 * Appends a `drifted` entry for an adopted item someone objected to. The ledger is append-only: the
 * adopted entry is never edited, and `parseSettledEntries` reads the latest entry for an id, so this
 * one wins. Nothing is deleted — an adopted item never had an open file. The answer is checked by
 * `settle.mjs`'s own `AnswerSchema` and the entry rendered by its own `renderSettledEntry`, so an
 * objection reads exactly like any other settled answer.
 *
 * @returns {{ ok: true, settledFile: string } | { ok: false, errors: string[] }}
 */
export function appendObjection({
  ctx,
  prd,
  adoptedEntry,
  item,
  answer,
  judgement,
}: {
  ctx: Pick<Context, 'root' | 'layout' | 'markers'>;
  prd: number | string;
  adoptedEntry: Pick<AdoptedEntry, 'itemText'>;
  item: SettledItemFacts;
  answer: unknown;
  judgement: Judgement;
}): { ok: true; settledFile: string } | { ok: false; errors: string[] } {
  const parsedAnswer = AnswerSchema.safeParse(answer);
  if (!parsedAnswer.success) {
    return {
      ok: false,
      errors: parsedAnswer.error.issues.map(
        (issue) => `${issue.path.join('.') || '(answer)'}: ${issue.message}`,
      ),
    };
  }
  const settledFile = `${ctx.layout.outboxDir(prd)}/${SETTLED_FILE}`;
  const absoluteSettled = join(ctx.root, settledFile);
  if (!existsSync(absoluteSettled)) {
    return { ok: false, errors: [`${settledFile}: no ledger holds the adopted item ${item.id}.`] };
  }
  const existing = readFileSync(absoluteSettled, 'utf8');
  const separator = existing.endsWith('\n') ? '\n' : '\n\n';
  const entry = renderSettledEntry({
    item,
    itemText: adoptedEntry.itemText,
    answer: parsedAnswer.data,
    judgement,
    markers: ctx.markers,
  });
  writeFileSync(absoluteSettled, `${existing}${separator}${entry}`);
  return { ok: true, settledFile };
}

/**
 * Reads the pull request's replies and settles what they decide. Writes `settled.md` and deletes
 * item files exactly as `settleItem` does — the caller commits them. An objection to an adopted item
 * appends a `drifted` entry and deletes nothing ({@link appendObjection}). With `post`, a due round
 * comment is posted as a NEW comment (by body); without it, the body is only returned.
 *
 * @param {{ ctx: object, prd: number, pr: number, post?: boolean }} args
 * @param {{ listComments: () => Array, createComment: (body: string) => any }} client
 */
export function readReplies(
  { ctx, prd, pr, post = false }: { ctx: Context; prd: number; pr: number; post?: boolean },
  client: { listComments: () => object[]; createComment: (body: string) => unknown },
) {
  const comments = client.listComments();
  const items = openItemsForPrd(prd, { ctx }) as OutboxItem[]; // ts-allow: comment.ts is typed by its own slice; it lists parsed open items
  const adopted = adoptedEntriesForPrd(prd, { ctx });
  const plan = planReplies({ comments, items, adopted, markers: ctx.markers });

  const settled: {
    number: number;
    id: string;
    verdict: SettledVerdict | null;
    answer: string;
    settledFile: string;
    removedFile: string | null;
    objection: boolean;
  }[] = [];
  const failed: { number: number; id: string; errors: string[] }[] = [];
  for (const { number, item, answer, judgement, adoptedEntry } of plan.settle) {
    const given = {
      text: answer.recorded,
      approvedBy: answer.approvedBy,
      approvedAt: answer.approvedAt,
      channel: {
        kind: 'feature-pull-request',
        number: pr,
        ...(answer.url ? { url: answer.url } : {}),
      },
      ...(answer.statedVerdict ? { statedVerdict: answer.statedVerdict } : {}),
    };
    const result:
      | { ok: true; verdict?: SettledVerdict; settledFile: string; removedFile?: string }
      | { ok: false; errors: string[] } = adoptedEntry
      ? appendObjection({ ctx, prd, adoptedEntry, item, answer: given, judgement })
      : settleItem({ ctx, file: item.file as string, answer: given }); // ts-allow: an open item is always read from its file
    if (result.ok) {
      settled.push({
        number,
        id: item.id,
        verdict: result.verdict ?? judgement.verdict,
        answer: answer.recorded,
        settledFile: result.settledFile,
        removedFile: result.removedFile ?? null,
        objection: Boolean(adoptedEntry),
      });
    } else {
      failed.push({ number, id: item.id, errors: result.errors });
    }
  }

  let round: { number: number; body: string; posted: unknown } | null = null;
  if (plan.round) {
    const body = formatRoundComment({
      round: plan.round.number,
      questions: plan.round.questions,
      markers: ctx.markers,
    });
    const posted = post ? client.createComment(body) : null;
    round = { number: plan.round.number, body, posted: posted ?? null };
  }

  return {
    settled,
    failed,
    held: plan.held.map(({ number, item, answer, due }) => ({
      number,
      id: item.id,
      answer: answer.text,
      due,
    })),
    round,
  };
}

/** A short plain summary of what a run did, for the terminal. Pure. */
export function summarize(result: ReturnType<typeof readReplies>): string {
  const agreed = result.settled.filter((entry) => entry.verdict === 'agreed').length;
  const drifted = result.settled.filter((entry) => entry.verdict === 'drifted').length;
  const lines = [
    `outbox-replies: settled ${agreed} agreed, ${drifted} drifted; ${result.held.length} held for a round.`,
  ];
  for (const entry of result.settled) {
    lines.push(
      `  question ${entry.number} (${entry.id}): ${entry.verdict}` +
        `${entry.objection ? ' (an objection to an adopted item)' : ''} — “${entry.answer}”`,
    );
  }
  for (const entry of result.held) {
    lines.push(
      `  question ${entry.number} (${entry.id}): unclear — “${entry.answer}”` +
        (entry.due ? ' — asked again in this round' : ' — already asked again, no new reply'),
    );
  }
  for (const entry of result.failed) {
    lines.push(
      `  question ${entry.number} (${entry.id}): not settled — ${entry.errors.join('; ')}`,
    );
  }
  if (result.settled.length > 0) {
    lines.push('Commit the settled.md append and the deleted item files together.');
  }
  return lines.join('\n');
}
