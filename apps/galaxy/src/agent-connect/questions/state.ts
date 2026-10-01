import type { ClaimKind } from '../../business/model';
import type { AgentQuestion } from './model';

// The questions card's state in the page (PRD 855 s3): the open questions, the one whose Answer once is
// open with its kind, value and product, the line saying what was last saved, and the last refusal.

export interface Answering {
  id: string;
  kind: ClaimKind;
  value: string;
  /** The product picked, when the question names none and the business has several. */
  product: string | null;
}

export interface QuestionsState {
  questions: AgentQuestion[];
  answering: Answering | null;
  busy: boolean;
  refusal: string | null;
  /** What was last done, in plain words. */
  done: string | null;
}

export type QuestionsAction =
  | { type: 'answer'; id: string }
  | { type: 'kind'; kind: ClaimKind }
  | { type: 'value'; value: string }
  | { type: 'product'; product: string }
  | { type: 'cancel' }
  | { type: 'busy' }
  | { type: 'answered'; id: string; claim: string }
  | { type: 'dismissed'; id: string }
  | { type: 'refused'; message: string };

export const initialQuestionsState = (questions: readonly AgentQuestion[]): QuestionsState =>
  ({ questions: [...questions], answering: null, busy: false, refusal: null, done: null });

const closing = (state: QuestionsState, id: string, done: string): QuestionsState => ({
  ...state, busy: false, answering: null, done, questions: state.questions.filter((q) => q.id !== id),
});

export function questionsReducer(state: QuestionsState, action: QuestionsAction): QuestionsState {
  const answering = state.answering;
  switch (action.type) {
    case 'answer':
      return { ...state, refusal: null, answering: { id: action.id, kind: 'region', value: '', product: null } };
    case 'kind':
      return answering ? { ...state, refusal: null, answering: { ...answering, kind: action.kind } } : state;
    case 'value':
      return answering ? { ...state, refusal: null, answering: { ...answering, value: action.value } } : state;
    case 'product':
      return answering ? { ...state, refusal: null, answering: { ...answering, product: action.product } } : state;
    case 'cancel':
      return { ...state, answering: null, refusal: null };
    case 'busy':
      return { ...state, busy: true, refusal: null, done: null };
    case 'answered':
      return closing(state, action.id, `✓ Saved as ${action.claim}. Every agent reads it from the next call.`);
    case 'dismissed':
      return closing(state, action.id, 'Dismissed. Nothing was stored.');
    case 'refused':
      return { ...state, busy: false, refusal: action.message };
  }
}
