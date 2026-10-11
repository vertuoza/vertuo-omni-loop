import { parsePrd, productPrdParts, type ProductPrdId } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { parseOutboxItem } from 'vertuo-omni-plan/kit/lib/outbox/outbox.ts';
import { interpretAnswer } from 'vertuo-omni-plan/kit/lib/outbox/replies.ts';
import { judgeAnswer } from 'vertuo-omni-plan/kit/lib/outbox/settle.ts';
import type { OutboxItemsService } from '../outbox-items/outbox-items.service';
import { AnswerReplySchema, type AnswerRefusal, type AnswerReply, type AnswerRequest } from './questions.contract';
import type { QuestionsRepository, Settled } from './questions.repository';

// Answering on the Questions tab (PRD 1548 s9; ADR-0095, spec "Answers on the Questions tab"): a member
// picks an option of an open question of a product PRD, or writes an answer of their own, and the
// question is settled on the server, as given on the Questions tab. The answer is read by the kit's own
// rules, as `omni answers` reads one in the terminal: a letter is that option (A agrees with what was
// built, any other drifts from it), and an answer of their own is judged against what was built; one the
// rules cannot read is refused, never guessed. The question is read through the outbox's own service, as
// the caller; the database has the last word on who may answer (a member of the PRD's workspace: anyone
// else finds no such PRD) and on a question already settled. Once a settlement is stored, the App is told
// (`item-settled`, PRD 1548 s8), so it re-posts the checks of the PRD's target pull requests.

/** A service answer: its value, or why it was refused, in plain words. */
type Answered = { ok: true; value: AnswerReply } | Refused;
type Refused = { ok: false; kind: AnswerRefusal; error: string };

/** What answering needs: the outbox's read of a product PRD's items, and the settlement's write. */
export interface QuestionsDeps {
  items: OutboxItemsService['items'];
  settle: QuestionsRepository['settle'];
  /** Told once a settlement is stored, so the App re-posts the PRD's checks (PRD 1548 s8). Never throws. */
  settled: (prd: { key: string; seq: number }) => Promise<void>;
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

/** The database's refusal of a settlement, in the tab's words. */
function settleRefusal(stored: Extract<Settled, { ok: false }>, prdId: string): Refused {
  if (stored.code === 'P0002') return refused('missing', stored.message ?? `No PRD ${prdId} in your workspaces.`);
  if (stored.code === '22023' && stored.hint === 'settled') return refused('settled', SETTLED);
  if (stored.code === '42501') return refused('signed-out', 'Sign in first to answer.');
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

/** What telling the App of a settlement takes: the dossier's read as the caller, the send, the clock, the log. */
export interface TellDeps {
  dossierOf: (prd: { key: string; seq: number; repo: null }) => Promise<{ ok: true; value: string | null } | { ok: false }>;
  send: (event: { event: 'item-settled'; dossier: string; at: string }) => Promise<unknown>;
  now: () => Date;
  log: (line: string) => void;
}

/** The `settled` step: tells the App `item-settled` on product PRD `<key>-<seq>`'s dossier. Never throws. */
export const tellSettled = ({ dossierOf, send, now, log }: TellDeps) => async ({ key, seq }: { key: string; seq: number }): Promise<void> => {
  const id = `${key}-${String(seq)}`;
  try {
    const dossier = await dossierOf({ key, seq, repo: null });
    if (dossier.ok && dossier.value !== null) await send({ event: 'item-settled', dossier: dossier.value, at: now().toISOString() });
    else log(`questions: the dossier of ${id} could not be read, the App is not told of its item-settled`);
  } catch (err) {
    log(`questions: telling the App of ${id}'s item-settled failed — ${err instanceof Error ? err.message : String(err)}`);
  }
};

export function questionsService(deps: QuestionsDeps) {
  return {
    /** Settles the open question `item` of product PRD `prdId` with the member's answer. */
    async answer({ prdId, item, answer }: AnswerRequest): Promise<Answered> {
      const open = await openQuestion(deps, prdId, item);
      if (!open.ok) return open;
      const judgement = judged(open.row, answer);
      if (!judgement.ok) return judgement;
      const { verdict, basis, recorded } = judgement;
      const prd = productPrdParts(prdId);
      const stored = await deps.settle(prd, { item, verdict, basis, answer: recorded });
      if (!stored.ok) return settleRefusal(stored, prdId);
      await deps.settled(prd);
      const reply = AnswerReplySchema.safeParse(stored.value);
      return reply.success ? { ok: true, value: reply.data } : refused('database', NOT_SAVED);
    },
  };
}

export type QuestionsService = ReturnType<typeof questionsService>;
