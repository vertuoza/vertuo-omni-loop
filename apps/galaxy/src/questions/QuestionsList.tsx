'use client';
import Link from 'next/link';
import { useReducer, useRef } from 'react';
import { questionsClient, type QuestionsPort } from './questions.client';
import { ANSWER_MAX, type QuestionView } from './questions.contract';
import {
  demoQuestionsPort, initialQuestionsForm, questionKey, questionsReducer, sendAnswer, stateOf, type QuestionsAction, type QuestionState,
} from './questions-model';

// The product's Questions tab, drawn (PRD 1548 s9, acceptance 9): every open outbox question of the
// product's PRDs, worst first within a PRD, each with its PRD, the repository it was raised in, its id and
// who it is for. A product PRD's question is answered here: its options as buttons, A the one built, and
// "other…" for an answer of one's own; the answer settles it on the server and the row shows `settled`.
// A repository's PRD keeps its answers on its PRD page's Outbox tab, linked. One answer is sent at a time;
// a refusal is shown under the question in the route's words. In the demo, answers settle in memory.

export const EMPTY_QUESTIONS = 'No outbox question of the product’s PRDs waits on a person.';
const OTHER = 'other…';
const SEND = 'Send';
const ON_OUTBOX_TAB = 'Answer on its Outbox tab →';
const VERDICT_WORDS = { agreed: 'keeps what was built', drifted: 'changes what was built' } as const;

export interface QuestionsHandlers {
  pick: (q: QuestionView, letter: string) => void;
  write: (q: QuestionView) => void;
  type: (q: QuestionView, text: string) => void;
  send: (q: QuestionView, text: string) => void;
}

const IDLE: QuestionsHandlers = { pick: () => {}, write: () => {}, type: () => {}, send: () => {} };

function Settled({ state }: { state: QuestionState }) {
  const words = state.verdict === null ? '' : ` · ${VERDICT_WORDS[state.verdict]}`;
  return <p className="questions-settled" role="status">Settled{words}{state.sent === null ? '' : ` — ${state.sent}`}</p>;
}

function OtherForm({ q, state, busy, on }: { q: QuestionView; state: QuestionState; busy: boolean; on: QuestionsHandlers }) {
  const id = `answer-${questionKey(q).replace(/[^\w-]/g, '-')}`;
  return (
    <form className="questions-other" onSubmit={(e) => { e.preventDefault(); on.send(q, state.other); }}>
      <label htmlFor={id}>Your answer</label>
      <textarea id={id} className="questions-other-text" rows={3} maxLength={ANSWER_MAX} value={state.other} disabled={busy}
        placeholder="Say yes, or what to change" onChange={(e) => { on.type(q, e.currentTarget.value); }} />
      <button type="submit" className="ask-button" disabled={busy || state.other.trim() === ''}>{SEND}</button>
    </form>
  );
}

function Answer({ q, state, busy, on }: { q: QuestionView; state: QuestionState; busy: boolean; on: QuestionsHandlers }) {
  if (state.status === 'settled') return <Settled state={state} />;
  const locked = busy || state.status === 'sending';
  return (
    <>
      <div className="questions-opts" role="group" aria-label={`Answer ${q.id}`}>
        {q.options.map((o) => (
          <button key={o.letter} type="button" className="ask-button quiet questions-opt" disabled={locked}
            data-sent={state.sent === o.letter || undefined} onClick={() => { on.pick(q, o.letter); }}>
            <b>{o.letter}</b> · {o.text}
          </button>
        ))}
        <button type="button" className="ask-button quiet questions-opt" aria-expanded={state.writing} disabled={locked} onClick={() => { on.write(q); }}>{OTHER}</button>
      </div>
      {state.writing ? <OtherForm q={q} state={state} busy={locked} on={on} /> : null}
      {state.refusal === null ? null : <p className="questions-refusal" role="alert">{state.refusal}</p>}
    </>
  );
}

/** One question's row; `state` is null for a question answered on its PRD page. */
export function QuestionRow({ q, state, busy, on = IDLE }: { q: QuestionView; state: QuestionState | null; busy: boolean; on?: QuestionsHandlers }) {
  const settled = state?.status === 'settled';
  return (
    <li className="product-home-row questions-row" data-row="question" data-question={q.id} data-state={settled ? 'settled' : q.rank}>
      <span className="product-home-n">{q.prdLabel}</span>
      <span className="product-home-main">
        <span className="product-home-title">{q.question}</span>
        <span className="product-home-meta">
          <span className="products-chip">{q.repo ?? 'no repository named'}</span>
          <span>{q.id}</span>
          <span className="questions-for">{q.forWhom}</span>
          <Link href={q.prdHref}>{q.title}</Link>
        </span>
        {state === null ? <Link className="questions-elsewhere" href={q.outboxHref}>{ON_OUTBOX_TAB}</Link> : <Answer q={q} state={state} busy={busy} on={on} />}
      </span>
      <span className="product-home-state">{settled ? 'settled' : q.rank}</span>
    </li>
  );
}

export function QuestionsList({ label, questions, demo }: { label: string; questions: QuestionView[]; demo: boolean }) {
  const [form, dispatch] = useReducer(questionsReducer, questions, initialQuestionsForm);
  const port = useRef<QuestionsPort | null>(null);
  const getPort = () => (port.current ??= demo ? demoQuestionsPort() : questionsClient());
  const act = (action: QuestionsAction) => { dispatch(action); };
  const on: QuestionsHandlers = {
    pick: (q, letter) => { if (form.busy === null) void sendAnswer(getPort(), q, letter, act); },
    write: (q) => { act({ type: 'write', key: questionKey(q) }); },
    type: (q, text) => { act({ type: 'type', key: questionKey(q), text }); },
    send: (q, text) => { if (form.busy === null && text.trim() !== '') void sendAnswer(getPort(), q, text.trim(), act); },
  };
  if (questions.length === 0) return <p className="products-empty">{EMPTY_QUESTIONS}</p>;
  return (
    <section className="products-list product-home-lane" aria-label={label}>
      <ul>
        {questions.map((q) => (
          <QuestionRow key={questionKey(q)} q={q} state={q.answerOn === null ? null : stateOf(form, questionKey(q))} busy={form.busy !== null} on={on} />
        ))}
      </ul>
    </section>
  );
}
