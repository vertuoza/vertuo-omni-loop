import { parsePrd, productPrdParts, type ProductPrdId } from 'omni-loop/kit/lib/ids.ts';
import { parseOutboxItem } from 'omni-loop/kit/lib/outbox/outbox.ts';
import { interpretAnswer } from 'omni-loop/kit/lib/outbox/replies.ts';
import { judgeAnswer } from 'omni-loop/kit/lib/outbox/settle.ts';
import type { OutboxRefusal } from '../outbox-items/outbox-items.contract';
import type { OutboxItemsService } from '../outbox-items/outbox-items.service';
import { AnswerReplySchema, type AnswerRefusal, type AnswerReply, type AnswerRequest } from './questions.contract';

// Answering on the Questions tab (PRD 1548 s9; ADR-0095, spec "Answers on the Questions tab"): a member
// picks an option of an open question of a product PRD, or writes an answer of their own, and the
// question is settled on the server, as given on the Questions tab. The answer is read by the kit's own
// rules, as `omni answers` reads one in the terminal: a letter is that option (A agrees with what was
// built, any other drifts from it), and an answer of their own is judged against what was built; one the
// rules cannot read is refused, never guessed. The question is read and settled through the outbox's own
// service (src/outbox-items), as the caller, its answer recorded as given on the Questions tab; the
// database has the last word on who may answer (a member of the PRD's workspace: anyone else finds no such
// PRD) and on a question already settled. The live wiring wraps that service so the App is told
// `item-settled` once a settlement is stored (PRD 1548 s8), as the outbox's own settle route tells it.

/** A service answer: its value, or why it was refused, in plain words. */
type Answered = { ok: true; value: AnswerReply } | Refused;
type Refused = { ok: false; kind: AnswerRefusal; error: string };

/** What answering needs: the outbox service's read of a product PRD's items, and its settlement. */
export interface QuestionsDeps {
  items: OutboxItemsService['items'];
  settle: OutboxItemsService['settle'];
}

/** One item of a product PRD, as the outbox's service reads it. */
type ItemRow = Extract<Awaited<ReturnType<OutboxItemsService['items']>>, { ok: true }>['value']['items'][number];

/** The verdict an answer gives, why, and the answer as it is recorded. */
type Judged = { ok: true; verdict: 'agreed' | 'drifted'; basis: string; recorded: string };

export const UNDETERMINED = 'Say whether this keeps what was built: start with “yes”, say what to change, or add a line “Verdict: agreed” or “Verdict: drifted”.';
const SETTLED = 'This question is already settled.';
const NOT_SAVED = 'The answer was not saved. Try again.';

const refused = (kind: AnswerRefusal, error: string): Refused => ({ ok: false, kind, error });
const noPrd = (prdId: string) => refused('missing', `No PRD ${prdId} in your workspaces.`);

/** The outbox's refusal of a settlement, in the tab's words. */
function settleRefusal({ kind, error }: { kind: OutboxRefusal; error: string }): Refused {
  if (kind === 'missing') return refused('missing', error);
  if (kind === 'settled') return refused('settled', SETTLED);
  if (kind === 'signed-out') return refused('signed-out', 'Sign in first to answer.');
  return refused('database', NOT_SAVED);
}

/** The open question `item` of product PRD `prdId`, as the caller reads it, or why it cannot be answered. */
async function openQuestion(deps: QuestionsDeps, prdId: ProductPrdId, item: string): Promise<{ ok: true; row: ItemRow } | Refused> {
  const { key, seq } = productPrdParts(prdId);
  const read = await deps.items({ product: key, prd: parsePrd(seq) });
  if (!read.ok) return read.kind === 'missing' ? noPrd(prdId) : refused(read.kind === 'signed-out' ? 'signed-out' : 'database', read.error);
  const row = read.value.items.find((r) => r.item === item);
  if (row === undefined) return refused('missing', `No question ${item} on PRD ${prdId}.`);
  return row.settlement === null ? { ok: true, row } : refused('settled', SETTLED);
}

/** The verdict `answer` gives the question `row` holds, read by the kit's rules, or why it reads as none. */
function judged(row: ItemRow, answer: string): Judged | Refused {
  const parsed = parseOutboxItem(row.body);
  const sections = parsed.ok ? parsed.item.sections : {};
  const reading = interpretAnswer({ text: answer, options: sections.options ?? [] });
  if (reading.undetermined) return refused('malformed', `Question ${row.item} has no option “${reading.recorded}”.`);
  const { verdict, basis } = judgeAnswer({ choice: sections.whatIDidMeanwhile ?? null, answer: reading.recorded, statedVerdict: reading.statedVerdict });
  return verdict === 'agreed' || verdict === 'drifted' ? { ok: true, verdict, basis, recorded: reading.recorded } : refused('undetermined', UNDETERMINED);
}

export function questionsService(deps: QuestionsDeps) {
  return {
    /** Settles the open question `item` of product PRD `prdId` with the member's answer. */
    async answer({ prdId, item, answer }: AnswerRequest): Promise<Answered> {
      const open = await openQuestion(deps, prdId, item);
      if (!open.ok) return open;
      const judgement = judged(open.row, answer);
      if (!judgement.ok) return judgement;
      const { verdict, basis, recorded } = judgement;
      const { key, seq } = productPrdParts(prdId);
      const stored = await deps.settle({ product: key, prd: parsePrd(seq), item, verdict, basis, answer: recorded, channel: 'questions' });
      if (!stored.ok) return settleRefusal(stored);
      const reply = AnswerReplySchema.safeParse(stored.value);
      return reply.success ? { ok: true, value: reply.data } : refused('database', NOT_SAVED);
    },
  };
}

export type QuestionsService = ReturnType<typeof questionsService>;
