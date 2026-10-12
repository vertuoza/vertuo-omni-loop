import { parseOutboxItemId, parseProductPrdId } from 'vertuo-omni-plan/kit/lib/ids.ts';
import type { Answered, QuestionsPort } from './questions.client';
import type { AnswerReply, QuestionView } from './questions.contract';

// The Questions tab's state in the browser (PRD 1548 s9): for each question answered here, whether it is
// open, being sent or settled, the answer of one's own being written, and the refusal last shown. One
// answer is sent at a time. Pure: a reducer, and the one step that sends an answer through a port and
// says what came back. In the demo the port answers in memory: A agrees, anything else drifts.

/** One question's state. */
export interface QuestionState {
  status: 'open' | 'sending' | 'settled';
  /** Whether the answer of one's own is open. */
  writing: boolean;
  /** The answer of one's own, as written so far. */
  other: string;
  /** What was sent, while it is being sent and once settled: a letter, or the answer written. */
  sent: string | null;
  verdict: AnswerReply['verdict'] | null;
  refusal: string | null;
}

export interface QuestionsForm {
  /** The question being sent, by key; null when none is. */
  busy: string | null;
  byKey: Readonly<Record<string, QuestionState>>;
}

export type QuestionsAction =
  | { type: 'write'; key: string }
  | { type: 'type'; key: string; text: string }
  | { type: 'send'; key: string; answer: string }
  | { type: 'settled'; key: string; verdict: AnswerReply['verdict'] }
  | { type: 'refused'; key: string; message: string };

const OPEN: QuestionState = { status: 'open', writing: false, other: '', sent: null, verdict: null, refusal: null };

/** A question's key on the tab: its PRD's dossier and its id. */
export const questionKey = (q: Pick<QuestionView, 'dossier' | 'id'>): string => `${q.dossier}:${q.id}`;

export const initialQuestionsForm = (questions: readonly QuestionView[]): QuestionsForm =>
  ({ busy: null, byKey: Object.fromEntries(questions.filter((q) => q.answerOn !== null).map((q) => [questionKey(q), OPEN])) });

/** A question's state; open when the form never heard of it. */
export const stateOf = (form: QuestionsForm, key: string): QuestionState => form.byKey[key] ?? OPEN;

const change = (form: QuestionsForm, key: string, next: Partial<QuestionState>, busy: string | null = form.busy): QuestionsForm =>
  ({ busy, byKey: { ...form.byKey, [key]: { ...stateOf(form, key), ...next } } });

export function questionsReducer(form: QuestionsForm, action: QuestionsAction): QuestionsForm {
  const { key } = action;
  const now = stateOf(form, key);
  if (now.status === 'settled') return form;
  switch (action.type) {
    case 'write': return change(form, key, { writing: !now.writing, refusal: null });
    case 'type': return change(form, key, { other: action.text });
    case 'send': return form.busy === null ? change(form, key, { status: 'sending', sent: action.answer, refusal: null }, key) : form;
    case 'settled': return change(form, key, { status: 'settled', writing: false, verdict: action.verdict, refusal: null }, null);
    case 'refused': return change(form, key, { status: 'open', sent: null, refusal: action.message }, null);
  }
}

/** Sends `answer` to question `q` through `port`, and says what came back as the actions to dispatch. */
export async function sendAnswer(port: QuestionsPort, q: QuestionView, answer: string, dispatch: (action: QuestionsAction) => void): Promise<void> {
  const key = questionKey(q);
  if (q.answerOn === null) return;
  dispatch({ type: 'send', key, answer });
  let answered: Answered;
  try {
    answered = await port.answer({ prdId: parseProductPrdId(q.answerOn), item: parseOutboxItemId(q.id), answer });
  } catch {
    answered = { ok: false, message: 'The answer was not saved. Try again.' };
  }
  dispatch(answered.ok ? { type: 'settled', key, verdict: answered.reply.verdict } : { type: 'refused', key, message: answered.message });
}

/** The demo's port: every answer settles, A as agreed and anything else as drifted, at once. */
export const demoQuestionsPort = (): QuestionsPort => ({
  answer: ({ prdId, item, answer }) => Promise.resolve({
    ok: true, reply: { prdId, item, verdict: answer.trim().toUpperCase() === 'A' ? 'agreed' : 'drifted', settledAt: new Date().toISOString() },
  }),
});
