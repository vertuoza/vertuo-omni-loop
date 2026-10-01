import type { FormEvent } from 'react';
import { KIND_LABEL, KIND_ORDER, maxValue, type ClaimKind, type Product } from '../../business/model';
import { dayLabel } from '../tokens/model';
import type { AgentQuestion } from './model';
import type { Answering, QuestionsState } from './state';

// Settings › Business › Questions agents couldn't answer, drawn from its state (PRD 855 s3). One row per
// open question, the latest asked first: the question, the link that asked it, the repository and file,
// when, and "asked N×" when it came again; each with Answer once (pick the kind, type the value, and the
// product when the question names none and the business has several) and Dismiss. Drawn on the server
// first; AgentQuestions.tsx wires the handlers.

export interface QuestionsHandlers {
  answer(question: AgentQuestion): void;
  kind(kind: ClaimKind): void;
  value(value: string): void;
  product(product: string): void;
  save(): void;
  cancel(): void;
  dismiss(question: AgentQuestion): void;
}

const IDLE: QuestionsHandlers = { answer() {}, kind() {}, value() {}, product() {}, save() {}, cancel() {}, dismiss() {} };

export const QUESTIONS_TITLE = 'Questions agents couldn’t answer';
const QUESTIONS_HINT = 'When no claim answers an agent, it sends its question here instead of guessing. Answer it once and every agent reads the answer.';
export const NO_QUESTIONS = 'No question waiting. Agents send here what the business doesn’t answer yet.';
export const ANSWER_ONCE = 'Answer once';
export const DISMISS = 'Dismiss';
export const SAVE_ANSWER = 'Save the answer';
const CANCEL = 'Cancel';
const SIZE_HINT = 'From-to in people, like 2-50';

/** "asked 2×" when a question came more than once. */
const askedLabel = (q: Pick<AgentQuestion, 'asked'>) => (q.asked > 1 ? `asked ${q.asked}×` : null);

export interface QuestionsCardProps {
  state: QuestionsState;
  /** The business's products, for an answer whose question names none. */
  products: Product[];
  demo?: boolean;
  on?: QuestionsHandlers;
}

function AnswerForm({ answering, needsProduct, products, busy, on }: {
  answering: Answering; needsProduct: boolean; products: Product[]; busy: boolean; on: QuestionsHandlers;
}) {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    on.save();
  };
  const blank = answering.value.trim() === '' || (needsProduct && answering.kind !== 'region' && !answering.product);
  return (
    <form className="business-type agent-question-answer" onSubmit={submit}>
      <label>
        <span className="business-type-label">Kind</span>
        <select name="kind" value={answering.kind} disabled={busy} onChange={(e) => on.kind(e.currentTarget.value as ClaimKind)}>
          {KIND_ORDER.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </select>
      </label>
      {needsProduct && answering.kind !== 'region' && (
        <label>
          <span className="business-type-label">Product</span>
          <select name="product" value={answering.product ?? ''} disabled={busy} onChange={(e) => on.product(e.currentTarget.value)}>
            <option value="" disabled>Pick one</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      )}
      <label>
        <span className="business-type-label">The answer</span>
        <input
          type="text" name="value" maxLength={maxValue(answering.kind)} value={answering.value} disabled={busy}
          placeholder={answering.kind === 'size' ? SIZE_HINT : undefined} onChange={(e) => on.value(e.target.value)}
        />
      </label>
      <button type="submit" className="ask-button" disabled={busy || blank}>{SAVE_ANSWER}</button>
      <button type="button" className="ask-button quiet" onClick={on.cancel} disabled={busy}>{CANCEL}</button>
    </form>
  );
}

function QuestionRow({ question, state, products, on }: { question: AgentQuestion; state: QuestionsState; products: Product[]; on: QuestionsHandlers }) {
  const answering = state.answering?.id === question.id ? state.answering : null;
  const asked = askedLabel(question);
  return (
    <li className="agent-question" data-question={question.id}>
      <div className="agent-row">
        <div className="agent-row-main">
          <strong>{question.question}</strong>
          <span className="agent-row-meta">
            <span>asked by {question.askedBy}</span>
            {question.repo && <span>{question.repo}</span>}
            {question.file && <code className="agent-question-file">{question.file}</code>}
            <span>{dayLabel(question.lastAskedAt)}</span>
            {asked && <span className="ask-chip" data-asked={question.asked}>{asked}</span>}
          </span>
        </div>
        {!answering && (
          <span className="agent-question-actions">
            <button type="button" className="ask-button" onClick={() => on.answer(question)} disabled={state.busy}>{ANSWER_ONCE}</button>
            <button type="button" className="ask-button quiet" aria-label={`${DISMISS}: ${question.question}`} onClick={() => on.dismiss(question)} disabled={state.busy}>{DISMISS}</button>
          </span>
        )}
      </div>
      {answering && (
        <AnswerForm answering={answering} needsProduct={question.product === null && products.length > 1} products={products} busy={state.busy} on={on} />
      )}
    </li>
  );
}

export function QuestionsCard({ state, products, demo = false, on = IDLE }: QuestionsCardProps) {
  return (
    <section className="ask-card agent-connect agent-questions" aria-labelledby="agent-questions-title">
      <div className="agent-connect-head">
        <h2 id="agent-questions-title">{QUESTIONS_TITLE}</h2>
        {demo && <span className="ask-chip">Demo</span>}
      </div>
      <p className="ask-muted">{QUESTIONS_HINT}</p>
      {state.refusal && <p className="business-refusal" role="alert">{state.refusal}</p>}
      {state.done && <p className="ask-muted" role="status">{state.done}</p>}
      {state.questions.length === 0
        ? <p className="ask-muted agent-none">{NO_QUESTIONS}</p>
        : (
          <ul className="agent-list" aria-label="Open questions">
            {state.questions.map((q) => <QuestionRow key={q.id} question={q} state={state} products={products} on={on} />)}
          </ul>
        )}
    </section>
  );
}
