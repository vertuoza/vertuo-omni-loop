'use client';
import { useReducer, useRef, useState, type SubmitEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '../../../../../supabase/database.types.ts';
import { ConstituentsPanel, type ConstituentHandlers } from '../../business/ConstituentsPanel';
import {
  constituentsReducer, initialConstituentsState, vagueHint, writeConstituent, type ConstituentField, type Constituents, type ConstituentsState,
} from '../../business/constituents-panel';
import { NEVER_MAX, STATEMENT_MAX } from '../../constituents/model';
import { databaseConstituents, demoConstituentsPort, type ConstituentPort } from '../../constituents/store';
import type { WriteSource } from './authors';

// What changes on the Constituents section, in the browser (PRD 2240 s4): a line's page draws the
// panel (../../business/ConstituentsPanel.tsx) for that one line, with its edit, remove and history, and
// the list draws a form under it to add a Statement or a Never line. Every write goes through
// ../../constituents/store.ts as the signed-in person, as Settings › Business sent it; once it is saved
// the page refreshes in place, so the server draws what is now true and the address, with its sort,
// stays. A removed line goes back to its list. In the demo, the same rules run in memory.

interface Props {
  source: WriteSource;
  read: Constituents;
  product: string;
}

function usePort(source: WriteSource, read: Constituents, product: string): () => ConstituentPort {
  const port = useRef<ConstituentPort | null>(null);
  return () => (port.current ??= source.kind === 'demo'
    ? demoConstituentsPort({ products: [product], by: read.me ?? 'demo' })
    : databaseConstituents(createBrowserClient<Database>(source.url, source.key), source.workspace));
}

/** The text a line had before an edit saves over it; null for a new one. */
const textBefore = (state: ConstituentsState, id: string | null): string | null => state.constituents.find((c) => c.id === id)?.text ?? null;

/** One line of the product, drawn alone by the panel: edit, remove and history. */
export function ConstituentLine({ source, read, product, focus, backHref }: Props & { focus: string; backHref: string }) {
  const router = useRouter();
  const [state, act] = useReducer(constituentsReducer, read, (r) => initialConstituentsState(r.constituents ?? [], r.events));
  const getPort = usePort(source, read, product);
  const write = async (w: Parameters<typeof writeConstituent>[1]) => {
    if (state.busy) return;
    act({ type: 'busy' });
    const answer = await writeConstituent(getPort(), w, read.me);
    act(answer);
    if (answer.type !== 'saved') return;
    if (answer.action === 'removed') router.push(backHref);
    router.refresh();
  };
  const on: ConstituentHandlers = {
    editStatement: (statement) => { act({ type: 'edit-statement', statement }); },
    addNever: () => { act({ type: 'add-never' }); },
    text: (text) => { act({ type: 'text', text }); },
    cancel: () => { act({ type: 'cancel' }); },
    save: () => {
      const field = state.editing;
      if (field && state.text.trim() !== '') void write({ kind: 'save', product, field, text: state.text, before: field.kind === 'statement' ? textBefore(state, field.id) : null });
    },
    remove: (line) => void write({ kind: 'remove', line }),
  };
  return <ConstituentsPanel state={state} product={product} owner={read.owner} people={read.people} unreadable={read.constituents === null} focus={focus} on={on} />;
}

type Kind = 'statement' | 'never';

/** Saves a new line through the port: the refusal the person reads, or null once it is saved. */
async function addLine(port: ConstituentPort, product: string, kind: Kind, text: string, me: string | null): Promise<string | null> {
  const field: ConstituentField = kind === 'never' ? { kind } : { kind, id: null };
  const answer = await writeConstituent(port, { kind: 'save', product, field, text, before: null }, me);
  return answer.type === 'refused' ? answer.message : null;
}

/** The add form under the list: a Statement while the product has none, and a Never line. Owners only. */
export function AddConstituent(props: Props & { hasStatement: boolean }) {
  return props.read.owner ? <AddForm {...props} /> : <p className="ask-muted">Only an owner of the workspace changes them.</p>;
}

/** Whether the form may save: a line is typed and no write is on its way. */
const canSave = (busy: boolean, text: string): boolean => !busy && text.trim() !== '';

/** The form's state, and the save that goes through the port and refreshes the page. */
function useAdd({ source, read, product, hasStatement }: Props & { hasStatement: boolean }) {
  const router = useRouter();
  const getPort = usePort(source, read, product);
  const [kind, setKind] = useState<Kind>(hasStatement ? 'never' : 'statement');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const submit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSave(busy, text)) return;
    setBusy(true);
    const refused = await addLine(getPort(), product, kind, text, read.me);
    setBusy(false);
    setRefusal(refused);
    if (refused !== null) return;
    setText('');
    setKind('never');
    router.refresh();
  };
  return { kind, setKind, text, setText, busy, refusal, submit };
}

const KindSelect = ({ kind, busy, hasStatement, onKind }: { kind: Kind; busy: boolean; hasStatement: boolean; onKind: (kind: Kind) => void }) => (
  <>
    <label className="ask-muted" htmlFor="add-constituent-kind">Add</label>
    <select id="add-constituent-kind" value={kind} disabled={busy} onChange={(e) => { onKind(e.currentTarget.value === 'never' ? 'never' : 'statement'); }}>
      {!hasStatement && <option value="statement">Statement</option>}
      <option value="never">Never line</option>
    </select>
  </>
);

const LineField = ({ kind, text, busy, hint, onText }: { kind: Kind; text: string; busy: boolean; hint: string | null; onText: (text: string) => void }) => (
  <input
    type="text" aria-label="The line" value={text} maxLength={kind === 'statement' ? STATEMENT_MAX : NEVER_MAX} disabled={busy}
    aria-describedby={hint ? 'add-constituent-hint' : undefined} onChange={(e) => { onText(e.currentTarget.value); }}
  />
);

const Notes = ({ hint, refusal }: { hint: string | null; refusal: string | null }) => (
  <>
    {hint && <p id="add-constituent-hint" className="constituents-hint" role="status">{hint}</p>}
    {refusal && <p className="business-refusal" role="alert">{refusal}</p>}
  </>
);

function AddForm(props: Props & { hasStatement: boolean }) {
  const { kind, setKind, text, setText, busy, refusal, submit } = useAdd(props);
  const hint = kind === 'never' ? vagueHint(text) : null;
  return (
    <form className="constituents-field" aria-label="Add a constituent" onSubmit={(e) => void submit(e)}>
      <KindSelect kind={kind} busy={busy} hasStatement={props.hasStatement} onKind={setKind} />
      <LineField kind={kind} text={text} busy={busy} hint={hint} onText={setText} />
      <Notes hint={hint} refusal={refusal} />
      <div className="constituents-actions">
        <button type="submit" className="ask-button" disabled={!canSave(busy, text)}>Save</button>
      </div>
    </form>
  );
}
