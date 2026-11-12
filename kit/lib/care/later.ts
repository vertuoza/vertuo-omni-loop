// PRD 2739, s3: what a `later` care reply leaves behind. The reply promises a person's review point
// for later, so the loop keeps it: a follow-up file whose `## Asked` is the person's comment word for
// word (BL-ASK-1) and whose `## Agent's note` is the reply, and a high outbox item asking a person to
// agree to postpone it (never#2). Pure, but for the one writer of the follow-up file.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { readFollowUps } from '../follow-ups/follow-ups.ts';
import { parseOutboxItemId, parseWorkSliceId } from '../ids.ts';
import type { OutboxItemId, PrdNumber } from '../ids.ts';
import { readCareVerdict } from './marker.ts';

/** The heading of the person's comment, kept word for word. */
const ASKED_HEADING = '## Asked';
/** The heading of the agent's own words. */
const NOTE_HEADING = "## Agent's note";
const SLUG_WORDS = 6;
const FIRST_WORDS = 8;
const MARKER = /\s*<!-- omni-care: [\w-]+ -->\s*$/;

/** The comment a thread asks with: its first one that carries no care marker, or `null`. */
export function askedComment<C extends { body: string }>(comments: readonly C[]): C | null {
  return comments.find((comment) => readCareVerdict(comment.body) === null) ?? null;
}

/** A review point's source: `PRD #<n> · <thread url>`. */
export function reviewSource(prd: PrdNumber, url: string): string {
  return `PRD #${prd} · ${url}`;
}

/** A review point's body: the person's comment as GitHub returned it, then the agent's note. */
function reviewBody(asked: string, note: string): string {
  return `${ASKED_HEADING}\n\n${asked}\n\n${NOTE_HEADING}\n\n${note.trim()}`;
}

/** The comment's first words in kebab-case, at most six; `review-point` when it has none. */
function slugOf(asked: string): string {
  const words = asked.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return words.length === 0 ? 'review-point' : words.slice(0, SLUG_WORDS).join('-');
}

/** The first file name free in `dir` for a point of `date` named `slug`. */
function freeName(dir: string, date: string, slug: string): string {
  let name = `${date}-${slug}.md`;
  for (let n = 2; existsSync(join(dir, name)); n += 1) name = `${date}-${slug}-${n}.md`;
  return name;
}

/**
 * Where a review point goes in the follow-up folder `dir`, `<date>-<slug>.md`, and the text to write
 * there; `text` is `null` when a point of the same source and body is already there, reused, never
 * written twice. Nothing is written: `writeReviewPoint` does, once the reply is posted.
 */
export function planReviewPoint(
  dir: string,
  { source, date, asked, note }: { source: string; date: string; asked: string; note: string },
): { file: string; text: string | null } {
  const body = reviewBody(asked, note);
  const same = readFollowUps(dir).find((point) => point.source === source && point.text === body.trim());
  if (same !== undefined) return { file: join(dir, same.file), text: null };
  return { file: join(dir, freeName(dir, date, slugOf(asked))), text: `---\nsource: ${source}\ndate: ${date}\n---\n\n${body}\n` };
}

/** Writes the point `planReviewPoint` planned; a reused one is left as it is. */
export function writeReviewPoint({ file, text }: { file: string; text: string | null }): void {
  if (text === null) return;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

/** The slice a `later` reply's item is raised on: care works on no slice of the plan. */
export const POSTPONE_SLICE = parseWorkSliceId('care-s0');

/** The next free id of a postponed point, `care-s0-<nn>-<slug>`, `nn` the smallest number not in `spent`. */
export function postponeItemId(spent: ReadonlySet<string>, slug: string): OutboxItemId {
  for (let n = 1; n <= 99; n += 1) {
    const prefix = `${POSTPONE_SLICE}-${String(n).padStart(2, '0')}-`;
    if (![...spent].some((id) => id.startsWith(prefix))) return parseOutboxItemId(`${prefix}${slug}`);
  }
  throw new Error(`every item number of ${POSTPONE_SLICE} is spent`);
}

/** A care reply's text, its marker dropped: the agent's note of a `later` reply. */
export function replyText(body: string): string {
  return body.replace(MARKER, '').trim();
}

/** A reply's first eight words, its marker dropped: how a refusal names it. */
export function replyFirstWords(body: string): string {
  const words = replyText(body).split(/\s+/).filter((word) => word !== '');
  return words.length > FIRST_WORDS ? `${words.slice(0, FIRST_WORDS).join(' ')}…` : words.join(' ');
}

/** `text` as a markdown quote, every line kept. */
function quoted(text: string): string {
  return text
    .split('\n')
    .map((line) => (line === '' ? '>' : `> ${line}`))
    .join('\n');
}

/** The question a postponed point asks, word for word as the spec names it. */
const QUESTION = 'Postpone this to a follow-up, or fix it in this PRD?';

/** What `postponeItem` is given: the thread, where the point was kept, and both sides' words. */
type PostponedPoint = { threadId: string; url: string; followUp: string; asked: string; note: string };

/**
 * The outbox item a `later` reply records: what the comment asked, why the agent proposes to postpone
 * it, the thread's id and url and the follow-up file, and the question a person answers. Its rank is
 * the recording policy's (`postponesReview`), never chosen here.
 */
export function postponeItem({ threadId, url, followUp, asked, note }: PostponedPoint) {
  const slug = basename(followUp, '.md').replace(/^\d{4}-\d{2}-\d{2}-/, '');
  return {
    slug: `postpone-${slug}`,
    questionPlain: `A reviewer asked for a change, and the agent proposes to make it after this PRD instead. ${QUESTION}`,
    decisionPlain: 'The agent answered the reviewer, closed the thread and kept the point as a follow-up, so nothing is lost while a person decides.',
    introFun: 'A reviewer asked for one more thing, and the agent answered: later.',
    punchlineFun: 'Later is a promise, so a person signs it before it counts.',
    options: [
      'Postpone it: keep the follow-up and make the change after this PRD.',
      'Fix it in this PRD: the change is made now and the follow-up is deleted.',
    ],
    decide: [
      `Whether a reviewer's comment can wait for a follow-up. Thread \`${threadId}\`: ${url}`,
      `The point is kept in \`${followUp}\`.`,
      '',
      'What the comment asked, word for word:',
      '',
      quoted(asked),
      '',
      'Why the agent proposes to postpone it:',
      '',
      quoted(note.trim()),
      '',
      QUESTION,
    ].join('\n'),
    meanwhile: `Replied \`later\` on the thread, resolved it, and kept the point in \`${followUp}\`.`,
    cost: 'Low: answering fix it now sends the point to a rework of this PRD, which deletes the follow-up file.',
    gaps: ['Whether the reviewer agrees that the point can wait.'],
  };
}
