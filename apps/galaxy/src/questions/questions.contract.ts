// The product's Questions tab, what it draws and what it sends (PRD 1548 s9; ADR-0095), as types and zod
// schemas the page, its browser client and its controller share. Browser-safe: zod and the kit's ids only.
//
//   POST /api/outbox/answer {prdId, item, answer} → 200 {item, prdId, verdict, settledAt}
//
// `prdId` names the product PRD (`mobile-12`), `item` the open question, and `answer` is what the member
// gave: an option's letter (`A`), or an answer of their own. The answer settles the item on the server, as
// given on the Questions tab; nothing is posted to GitHub. A refusal is `{error}` in plain words
// (ADR-0029): 400 a malformed request or a letter the question has no option for, 401 signed out, 404 no
// such PRD or question in the caller's workspaces (a non-member's answer among them), 409 a question
// already settled, 422 an answer of their own that says neither yes nor what to change, 503 no database
// here, 500 the database failed.
import { z } from 'zod';
import { OutboxItemIdSchema, ProductPrdIdSchema } from 'omni-loop/kit/lib/ids.ts';

/** Where the tab sends an answer. */
export const ANSWER_ROUTE = '/api/outbox/answer';

/** The longest answer a member may write, as the database keeps it. */
export const ANSWER_MAX = 20_000;

/** An answer to one open question of a product PRD. */
export const AnswerRequestSchema = z.object({
  prdId: ProductPrdIdSchema,
  item: OutboxItemIdSchema,
  answer: z.string().trim().min(1).max(ANSWER_MAX),
}).strict();
export type AnswerRequest = z.infer<typeof AnswerRequestSchema>;

/** What an answer settled: the question, its PRD, the verdict read from the answer, and when. */
export const AnswerReplySchema = z.object({
  item: OutboxItemIdSchema,
  prdId: ProductPrdIdSchema,
  verdict: z.enum(['agreed', 'drifted']),
  settledAt: z.string(),
});
export type AnswerReply = z.infer<typeof AnswerReplySchema>;

/** A refusal, in plain words. */
export const AnswerErrorSchema = z.object({ error: z.string() });

/** Why an answer was refused, each with its status. */
export const ANSWER_REFUSALS = {
  malformed: 400, 'signed-out': 401, missing: 404, settled: 409, undetermined: 422, unavailable: 503, database: 500,
} as const;
export type AnswerRefusal = keyof typeof ANSWER_REFUSALS;

/** One option of a question: its letter and its words. A is what was built. */
export interface QuestionOption {
  letter: string;
  text: string;
}

/** One open outbox question of a PRD of the product, as the Questions tab draws it. */
export interface QuestionView {
  /** The PRD's dossier. */
  dossier: string;
  /** The PRD's page, and its Outbox tab. */
  prdHref: string;
  outboxHref: string;
  /** The PRD as people write it: `mobile-12` for a product PRD, its number for a repository's. */
  prdLabel: string;
  /** The PRD's title. */
  title: string;
  /** The repository the question was raised in; null when it named none. */
  repo: string | null;
  /** The item's id. */
  id: string;
  rank: string;
  /** The question, in plain words. */
  question: string;
  /** Who it is for, in a few words: `for you`, `for irisa`, `for a person who can do it`. */
  forWhom: string;
  /** Its options, A first; none for a question that asks a person to act, or whose options live elsewhere. */
  options: QuestionOption[];
  /** The product PRD it is answered on here, or null: a repository's PRD answers on its Outbox tab. */
  answerOn: string | null;
}
