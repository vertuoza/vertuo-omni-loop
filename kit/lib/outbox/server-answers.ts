// The terminal door of a product PRD's outbox (PRD 1548 s7): `omni answers` on `mobile-12`. A product
// PRD has no feature pull request whose outbox comment numbers its questions, so they are numbered here,
// from its open items, worst first (`sortItems`), as the comment would list them. The picks are
// checked by the same reply writer `omni answers post` uses on a pull request, then each line is read
// as `omni replies` reads one and settled on the server through the PRD's store, as answered in the
// terminal: nothing is posted anywhere.
import { defined } from '../narrow.ts';
import type { ProductPrdId } from '../ids.ts';
import type { OutboxItem } from '../types.ts';
import { answerableQuestions, writeReply } from './answers.ts';
import type { CommentNumbering } from './answers.ts';
import { sortItems } from './comment.ts';
import { interpretAnswer, parseReplyLines } from './replies.ts';
import type { OutboxStore } from './store.ts';

/** The numbers of a product PRD's open items, worst first from 1, as its outbox comment would list them. */
export function serverNumbering(items: readonly OutboxItem[]): CommentNumbering {
  return sortItems(items).map((item, index) => ({ number: index + 1, id: item.id }));
}

/** What answering a product PRD's questions did: each question settled, with its verdict, and each the
 * store refused, with why. */
type ServerAnswers = {
  settled: { number: number; id: string; verdict: string }[];
  failed: { number: number; id: string; errors: string[] }[];
};

/** Settles product PRD `prd`'s questions `picks` answers (`{ number, pick, reason?, text? }`, as `omni
 * answers post` reads them), or why the picks were refused, with nothing settled. */
export async function answerOnServer({ store, prd, picks }: { store: OutboxStore; prd: ProductPrdId; picks: unknown }): Promise<({ ok: true } & ServerAnswers) | { ok: false; reason: string }> {
  const items = await store.openItems(prd);
  const questions = answerableQuestions({ numbering: serverNumbering(items), items });
  const written = writeReply({ prd, door: 'terminal', questions, picks });
  if (!written.ok) return written;
  const byNumber = new Map(questions.map((question) => [question.number, question]));
  const answers: ServerAnswers = { settled: [], failed: [] };
  // The reply writer writes one numbered line per pick, of a question it found: never an approve-all.
  for (const line of parseReplyLines(written.reply)) {
    if (line.kind !== 'numbered') continue;
    const { number, id, item, options } = defined(byNumber.get(line.number), `question ${line.number}`);
    const reading = interpretAnswer({ text: line.text, options });
    const answer = { text: reading.recorded, ...(reading.statedVerdict ? { statedVerdict: reading.statedVerdict } : {}) };
    const result = await store.settle(defined(item.file, `the ref of ${id}`), answer);
    if (result.ok) answers.settled.push({ number, id, verdict: result.verdict });
    else answers.failed.push({ number, id, errors: result.errors });
  }
  return { ok: true, ...answers };
}
