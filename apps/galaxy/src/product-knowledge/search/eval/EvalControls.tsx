'use client';
import { useState, type SyntheticEvent } from 'react';
import { useRouter } from 'next/navigation';
import { addEvalQuestion, removeEvalQuestion, setEvalAnswer } from './eval-actions';
import type { EvalWrite } from './eval-stats';

// What a member changes on the Eval view, in the browser (PRD omni-loop-8 s5): confirm, remove or add a right
// answer, add or remove a question. Each is one server action as the signed-in person (eval-actions.ts); once it is
// kept the page refreshes in place, so the server draws who made the change, and a refusal says so by the control.

export interface Choice { key: string; label: string }

/** The busy flag and the refusal of one control; `run` refreshes the page when the write was kept. */
function useWrite() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const run = async (write: () => Promise<EvalWrite>): Promise<boolean> => {
    if (busy) return false;
    setBusy(true);
    setRefusal(null);
    const done = await write();
    setBusy(false);
    if (done.ok) router.refresh();
    else setRefusal(done.message);
    return done.ok;
  };
  return { busy, refusal, run };
}

const Refusal = ({ message }: { message: string | null }) => (message === null ? null : <span className="business-refusal" role="alert">{message}</span>);

/** A button that sets a person's word on one entry: Confirm, Remove or Restore. */
export function AnswerButton({ question, entry, relevant, label }: { question: string; entry: string; relevant: boolean; label: string }) {
  const { busy, refusal, run } = useWrite();
  return (
    <>
      <button type="button" className="ask-button quiet ev-button" disabled={busy} onClick={() => { void run(() => setEvalAnswer(question, entry, relevant)); }}>{label}</button>
      <Refusal message={refusal} />
    </>
  );
}

/** Removes a question from the set. */
export function RemoveQuestion({ question }: { question: string }) {
  const { busy, refusal, run } = useWrite();
  return (
    <>
      <button type="button" className="ask-button quiet ev-button" disabled={busy} onClick={() => { void run(() => removeEvalQuestion(question)); }}>Remove question</button>
      <Refusal message={refusal} />
    </>
  );
}

/** Adds the entry Jev missed, by its id, as a right answer a person gave. */
export function AddAnswer({ question }: { question: string }) {
  const { busy, refusal, run } = useWrite();
  const [entry, setEntry] = useState('');
  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    const id = entry.trim();
    if (id === '') return;
    void run(() => setEvalAnswer(question, id, true)).then((kept) => { if (kept) setEntry(''); });
  };
  return (
    <form className="ev-form" onSubmit={submit}>
      <label>
        <span className="ask-muted">Add an entry Jev missed</span>
        <input type="text" value={entry} onChange={(e) => { setEntry(e.target.value); }} placeholder="entry id, as search shows it" disabled={busy} />
      </label>
      <button type="submit" className="ask-button quiet ev-button" disabled={busy || entry.trim() === ''}>Add right answer</button>
      <Refusal message={refusal} />
    </form>
  );
}

/** Adds a question to the set, with its category when one is chosen. */
export function AddQuestion({ product, categories }: { product: string; categories: readonly Choice[] }) {
  const { busy, refusal, run } = useWrite();
  const [text, setText] = useState('');
  const [category, setCategory] = useState('');
  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    const question = text.trim();
    if (question === '') return;
    void run(() => addEvalQuestion(product, question, category === '' ? null : category)).then((kept) => { if (kept) setText(''); });
  };
  return (
    <form className="ev-form ev-add-question" onSubmit={submit}>
      <label>
        <span>Add a question to the set</span>
        <input type="text" value={text} onChange={(e) => { setText(e.target.value); }} placeholder="what an agent would ask" disabled={busy} />
      </label>
      <label>
        <span className="ask-muted">Category</span>
        <select value={category} onChange={(e) => { setCategory(e.target.value); }} disabled={busy}>
          <option value="">No category</option>
          {categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
      </label>
      <button type="submit" className="ask-button ev-button" disabled={busy || text.trim() === ''}>Add question</button>
      <Refusal message={refusal} />
    </form>
  );
}
