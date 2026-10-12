import { refuse, reply } from '../business-api/reply';
import { ANSWER_REFUSALS, AnswerReplySchema, AnswerRequestSchema } from './questions.contract';
import type { QuestionsService } from './questions.service';

// The Questions tab's answer, at its HTTP edge (PRD 1548 s9; ADR-0095), as a plain function of a Request,
// so it is tested with a fake service and the route stays one line:
//
//   POST /api/outbox/answer {prdId, item, answer} → 200 {item, prdId, verdict, settledAt}
//
// The tab's browser client (questions.client.ts) calls it with the sign-in cookie. The session is checked
// first: no database here, 503; signed out (or the demo), 401, and no service runs. The service then reads
// and writes as that person, never a service key, so row-level security and outbox_settle() decide: a
// non-member finds no such PRD. Each answer is checked against the contract before it leaves; each refusal
// is `{error}` in plain words (questions.contract.ts). A failure is 500, logged.

export type QuestionsHandlerDeps = {
  /** The service as the signed-in person; null when nobody is signed in, `closed` with no database here. */
  signedIn: () => Promise<QuestionsService | null | 'closed'>;
  log: (line: string) => void;
};

const MAX_BODY_BYTES = 32 * 1024;
const NO_DATABASE = 'Questions are not answered here: this deployment has no database.';
const SIGNED_OUT = 'Sign in first to answer a question.';
const MALFORMED = 'The body must be {"prdId": "<key>-<n>", "item": "<id>", "answer": "<a letter, or your answer>"}.';
const FAILED = 'The answer was not saved. Try again.';

/** `text` as JSON, or null when it is none. */
function jsonOf(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** The request's answer, or null when it is too large, no JSON, or out of shape. */
async function answerOf(request: Request) {
  const text = await request.text();
  const read = new TextEncoder().encode(text).length > MAX_BODY_BYTES ? null : AnswerRequestSchema.safeParse(jsonOf(text));
  return read?.success === true ? read.data : null;
}

/** POST /api/outbox/answer: settles one open question of a product PRD with the member's answer. */
export async function answerQuestion(request: Request, deps: QuestionsHandlerDeps): Promise<Response> {
  const service = await deps.signedIn();
  if (service === 'closed') return refuse(ANSWER_REFUSALS.unavailable, NO_DATABASE);
  if (service === null) return refuse(ANSWER_REFUSALS['signed-out'], SIGNED_OUT);
  const asked = await answerOf(request);
  if (asked === null) return refuse(ANSWER_REFUSALS.malformed, MALFORMED);
  try {
    const answered = await service.answer(asked);
    if (answered.ok) return reply(200, AnswerReplySchema.parse(answered.value));
    if (answered.kind === 'database') deps.log(`questions: ${answered.error} (${asked.prdId} ${asked.item})`);
    return refuse(ANSWER_REFUSALS[answered.kind], answered.error);
  } catch (err) {
    deps.log(`questions: ${err instanceof Error ? err.message : String(err)} (${asked.prdId} ${asked.item})`);
    return refuse(ANSWER_REFUSALS.database, FAILED);
  }
}
