/**
 * **The reply writer** (PRD 251): every door that answers an outbox — the terminal at the end of
 * `/omni:yolo`, the Omni page, a person typing on the pull request — ends as one reply on the feature
 * pull request, in the grammar {@link planReplies} (`replies.mjs`) already reads. This module writes
 * that reply, once, for every door that is not a person typing: the kit and the page import it, so
 * they write identical lines.
 *
 * - {@link writeReply} turns picks into the reply: one `<n>: <answer>` line per pick, in number
 *   order, then an empty line and the door's line. It refuses what the reader would not read as the
 *   person meant it.
 * - {@link cleanLine} makes a reason or a prose answer one line of at most 500 characters, with no
 *   outbox marker in it, so no reply can hide itself from the reader or smuggle in a second answer.
 * - {@link answerableQuestions} and {@link askBatches} read the questions off the numbering the pull
 *   request comment carries, the same numbers the pull request shows.
 *
 * Pure: no disk, no network. The contract with the reader is a test (`answers.test.mjs`): whatever
 * this writes, `planReplies` reads back as the same answer.
 */
import { z } from 'zod';
import { parseOutboxItem } from './outbox.mjs';

/** The longest a reason or a prose answer may be, once made one line. */
export const REASON_MAX_LENGTH = 500;

/** The largest batch of questions asked at once — what one `AskUserQuestion` call takes. */
export const ASK_BATCH_SIZE = 4;

/** Each door's closing line, before `· PRD <n>`. */
export const DOORS = Object.freeze({
  terminal: 'answered in the terminal',
  page: 'answered on the Omni page',
});

const HUMAN_ACTION = 'human-action';

/** One pick: a letter the question offers, `done` / `not-done` on a human action, or `prose`. */
export const PickSchema = z
  .object({
    number: z.number().int().positive(),
    pick: z.string().trim().min(1),
    reason: z.string().optional(),
    text: z.string().optional(),
  })
  .strict();

const PicksSchema = z.array(PickSchema);

/**
 * A reason or a prose answer as one clean line: every run of whitespace (newlines included) becomes
 * one space, every `<!--` and `-->` is removed — until none is left, so removing one cannot join
 * two halves into another — and the rest is cut to {@link REASON_MAX_LENGTH} characters.
 */
export function cleanLine(text) {
  let line = String(text ?? '');
  let previous;
  do {
    previous = line;
    line = line.replace(/<!--|-->/g, '');
  } while (line !== previous);
  return line.replace(/\s+/g, ' ').trim().slice(0, REASON_MAX_LENGTH).trim();
}

function describeIssue(issue) {
  const path = issue.path.length ? `pick ${issue.path.map(String).join('.')}` : 'picks';
  return `${path}: ${issue.message}`;
}

/** The line one pick writes, or the reason it is refused. */
function lineFor(question, pick) {
  const { number } = question;
  const kind = pick.pick.trim();
  const lower = kind.toLowerCase();
  const isAction = question.rank === HUMAN_ACTION;

  if (lower === 'prose') {
    const text = cleanLine(pick.text);
    if (!text) return { reason: `question ${number}: a prose answer needs its text` };
    return { line: `${number}: ${text}` };
  }
  if (lower === 'done' || lower === 'not-done') {
    if (!isAction) return { reason: `question ${number} is a decision: pick one of its options` };
    if (lower === 'done') return { line: `${number}: ok` };
    const reason = cleanLine(pick.reason);
    if (!reason) return { reason: `question ${number}: not-done needs a reason` };
    return { line: `${number}: no, because ${reason}` };
  }
  if (/^[A-Za-z]$/.test(kind)) {
    if (isAction) return { reason: `question ${number} needs a person: answer done or not-done` };
    const letter = kind.toUpperCase();
    const offered = (question.options ?? []).some((option) => option.letter === letter);
    if (!offered) return { reason: `question ${number} offers no option ${letter}` };
    const reason = cleanLine(pick.reason);
    return { line: reason ? `${number}: ${letter} because ${reason}` : `${number}: ${letter}` };
  }
  return { reason: `question ${number}: "${kind}" is not a pick — a letter, done, not-done or prose` };
}

/**
 * Writes the reply one person gives through a door. Pure.
 *
 * @param {{ prd: number, door: 'terminal' | 'page',
 *   questions: Array<{ number: number, rank: string, options?: { letter: string }[] }>,
 *   picks: Array<{ number: number, pick: string, reason?: string, text?: string }> }} args
 *   `questions` is every question the reply may answer (see {@link answerableQuestions}).
 * @returns {{ ok: true, reply: string } | { ok: false, reason: string }}
 */
export function writeReply({ prd, door, questions, picks }) {
  if (!Object.hasOwn(DOORS, door)) return { ok: false, reason: `unknown door "${door}": terminal or page` };
  const parsed = PicksSchema.safeParse(picks);
  if (!parsed.success) return { ok: false, reason: describeIssue(parsed.error.issues[0]) };
  if (parsed.data.length === 0) return { ok: false, reason: 'no answer to write' };

  const byNumber = new Map((questions ?? []).map((question) => [question.number, question]));
  const seen = new Set();
  const lines = [];
  for (const pick of [...parsed.data].sort((a, b) => a.number - b.number)) {
    if (seen.has(pick.number)) return { ok: false, reason: `question ${pick.number} is answered twice` };
    seen.add(pick.number);
    const question = byNumber.get(pick.number);
    if (!question) return { ok: false, reason: `question ${pick.number} is not open on this pull request` };
    const result = lineFor(question, pick);
    if (result.reason) return { ok: false, reason: result.reason };
    lines.push(result.line);
  }
  return { ok: true, reply: [...lines, '', `_${DOORS[door]} · PRD ${prd}_`].join('\n') };
}

/**
 * Every question a reply may answer, by number: each open item the numbering names, and each adopted
 * item it names (read back off its settled entry, as the reader does), in number order. Pure.
 *
 * @param {{ numbering: { number: number, id: string }[], items: object[], adopted?: { id: string, itemText: string }[] }} args
 * @returns {Array<{ number: number, id: string, rank: string, options: { letter: string, text: string }[], adopted: boolean, item: object }>}
 */
export function answerableQuestions({ numbering, items, adopted = [] }) {
  const open = new Map(items.map((item) => [item.id, item]));
  const kept = new Map();
  for (const entry of adopted) {
    const parsed = parseOutboxItem(entry.itemText, { file: null });
    if (parsed.ok) kept.set(entry.id, parsed.item);
  }
  const questions = [];
  for (const { number, id } of numbering) {
    const item = open.get(id) ?? kept.get(id);
    if (!item) continue;
    questions.push({
      number,
      id,
      rank: item.rank,
      options: item.sections?.options ?? [],
      adopted: !open.has(id),
      item,
    });
  }
  return questions.sort((a, b) => a.number - b.number);
}

/** The text a question is asked with: the question and the decision, in plain words. */
function askedText(item) {
  const sections = item.sections ?? {};
  return [sections.questionPlain ?? sections.whatIHadToDecide, sections.decisionPlain]
    .filter(Boolean)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .join(' ');
}

/**
 * The questions the terminal asks: the open `human-action` and `high` ones — never a medium, which
 * is already adopted — `human-action` first, then by number, in batches of at most
 * {@link ASK_BATCH_SIZE}. Each carries its header (`Q19 · action`, `Q1 · high`), its text and its
 * options, each option with the `pick` an answers file gives back. Pure.
 *
 * @param {{ numbering: { number: number, id: string }[], items: object[] }} args
 */
export function askBatches({ numbering, items }) {
  const asked = answerableQuestions({ numbering, items })
    .filter((question) => !question.adopted && (question.rank === HUMAN_ACTION || question.rank === 'high'))
    .sort((a, b) => Number(b.rank === HUMAN_ACTION) - Number(a.rank === HUMAN_ACTION) || a.number - b.number)
    .map(({ number, id, rank, options, item }) => {
      const isAction = rank === HUMAN_ACTION;
      return {
        number,
        id,
        rank,
        header: `Q${number} · ${isAction ? 'action' : rank}`,
        text: askedText(item),
        ...(isAction ? { steps: (item.sections?.personSteps ?? '').trim() } : {}),
        options: isAction
          ? [
              { pick: 'done', label: 'Done', text: 'It is done.' },
              { pick: 'not-done', label: 'Not done', text: 'It is not done: say why.' },
            ]
          : options.map((option) => ({
              pick: option.letter,
              label: option.letter === 'A' ? 'A · built' : option.letter,
              text: option.text,
            })),
      };
    });
  const batches = [];
  for (let start = 0; start < asked.length; start += ASK_BATCH_SIZE) {
    batches.push(asked.slice(start, start + ASK_BATCH_SIZE));
  }
  return batches;
}
