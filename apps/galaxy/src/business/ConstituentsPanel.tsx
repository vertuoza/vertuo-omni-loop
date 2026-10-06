import type { SubmitEvent } from 'react';
import { NEVER_MAX, STATEMENT_MAX, type Constituent, type ConstituentEvent } from '../constituents/model';
import { PersonChip } from '../people/PersonChip';
import type { Person } from '../people/types';
import { faceOf } from '../people/face';
import {
  ACTION_LABEL, eventTarget, neverAnchor, panelOf, vagueHint, whenOf,
  type ConstituentsState,
} from './constituents-panel';

// Settings › Business's Constituents panel (PRD 871 s2), drawn from its state (./constituents-panel.ts):
// above the claims, the tab's product's Statement and its Never list, each line anchored `#never-<n>`,
// then the History drawer, every event newest first with the person's chip, the date and time, and the
// text before and after. An owner sees Edit (or + Statement), + Never line and Remove; a member sees
// the same panel with none of them. While an owner types a Never line, the vague-word hint shows under
// the field and never blocks Save. Drawn on the server first; BusinessPage.tsx wires the handlers.

export interface ConstituentHandlers {
  editStatement: (statement: Constituent | null) => void;
  addNever: () => void;
  text: (text: string) => void;
  cancel: () => void;
  save: () => void;
  remove: (line: Constituent) => void;
}

const IDLE: ConstituentHandlers = { editStatement() {}, addNever() {}, text() {}, cancel() {}, save() {}, remove() {} };

export const CONSTITUENTS_TITLE = 'Constituents';
const CONSTITUENTS_LEAD = 'What this product is, and what it must never become. Every agent reads them first, above any priority.';
const STATEMENT_TITLE = 'Statement';
const NEVER_LIST_TITLE = 'Never';
export const EDIT_STATEMENT = 'Edit';
export const ADD_STATEMENT = '+ Statement';
export const ADD_NEVER_LINE = '+ Never line';
export const REMOVE = 'Remove';
export const SAVE = 'Save';
const CANCEL = 'Cancel';
export const NO_STATEMENT = 'No Statement yet.';
export const NO_NEVER = 'No Never line yet.';
const OWNERS_ONLY = 'Only an owner of the workspace changes them.';
const HISTORY = 'History';
const NO_HISTORY = 'Nothing changed yet.';
export const UNREADABLE = 'Couldn’t load the constituents. Reload in a moment.';
const STATEMENT_FIELD = 'What the product is, in one statement';
const NEVER_FIELD = 'What the product must never become or do';

/** Who an event names: the move has nobody; an account no member holds any more reads so. */
const MOVED_BY: Person = { name: 'Omni Loop', face: faceOf({ name: 'Omni Loop' }) };
const FORMER: Person = { name: 'A former member', face: faceOf({ name: 'A former member' }) };

export interface ConstituentsPanelProps {
  state: ConstituentsState;
  /** The product whose tab is shown; null draws nothing. */
  product: string | null;
  /** The signed-in person owns the workspace: only then are the controls drawn. */
  owner: boolean;
  /** The people the history names, by account id. */
  people: Readonly<Record<string, Person>>;
  /** The constituents could not be read: the panel says so, and the page carries on. */
  unreadable?: boolean;
  on?: ConstituentHandlers;
}

function Field({ kind, state, on }: { kind: 'statement' | 'never'; state: ConstituentsState; on: ConstituentHandlers }) {
  const hint = kind === 'never' ? vagueHint(state.text) : null;
  const submit = (e: SubmitEvent) => {
    e.preventDefault();
    on.save();
  };
  const id = `constituent-field-${kind}`;
  return (
    <form className="constituents-field" onSubmit={submit}>
      <label htmlFor={id} className="ask-muted">{kind === 'statement' ? STATEMENT_FIELD : NEVER_FIELD}</label>
      <input
        id={id}
        type="text"
        value={state.text}
        maxLength={kind === 'statement' ? STATEMENT_MAX : NEVER_MAX}
        onChange={(e) => { on.text(e.target.value); }}
        aria-describedby={hint ? `${id}-hint` : undefined}
        disabled={state.busy}
      />
      {hint && <p id={`${id}-hint`} className="constituents-hint" role="status">{hint}</p>}
      <div className="constituents-actions">
        <button type="submit" className="ask-button" disabled={state.busy || state.text.trim() === ''}>{SAVE}</button>
        <button type="button" className="ask-button quiet" onClick={on.cancel} disabled={state.busy}>{CANCEL}</button>
      </div>
    </form>
  );
}

function StatementBlock({ statement, state, owner, on }: { statement: Constituent | null; state: ConstituentsState; owner: boolean; on: ConstituentHandlers }) {
  const editing = owner && state.editing?.kind === 'statement';
  return (
    <div className="constituents-statement" id="statement" data-constituent="statement">
      <h3>{STATEMENT_TITLE}</h3>
      {editing
        ? <Field kind="statement" state={state} on={on} />
        : (
          <div className="constituents-row">
            {statement ? <p className="constituents-text">{statement.text}</p> : <p className="ask-muted">{NO_STATEMENT}</p>}
            {owner && (
              <button type="button" className="ask-button quiet" onClick={() => { on.editStatement(statement); }} disabled={state.busy}>
                {statement ? EDIT_STATEMENT : ADD_STATEMENT}
              </button>
            )}
          </div>
        )}
    </div>
  );
}

function NeverList({ lines, state, owner, on }: { lines: readonly Constituent[]; state: ConstituentsState; owner: boolean; on: ConstituentHandlers }) {
  return (
    <div className="constituents-never">
      <h3>{NEVER_LIST_TITLE}</h3>
      {lines.length === 0
        ? <p className="ask-muted">{NO_NEVER}</p>
        : (
          <ul>
            {lines.map((line) => (
              <li key={line.id} id={neverAnchor(line)} className="constituents-never-line" data-constituent={line.displayId}>
                <code>{line.displayId}</code>
                <span className="constituents-text">{line.text}</span>
                {owner && (
                  <button type="button" className="ask-button quiet" aria-label={`${REMOVE} ${line.displayId}: ${line.text}`} onClick={() => { on.remove(line); }} disabled={state.busy}>
                    {REMOVE}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      {owner && (state.editing?.kind === 'never'
        ? <Field kind="never" state={state} on={on} />
        : <button type="button" className="ask-button quiet" onClick={on.addNever} disabled={state.busy}>{ADD_NEVER_LINE}</button>)}
    </div>
  );
}

function HistoryEntry({ event, state, people }: { event: ConstituentEvent; state: ConstituentsState; people: Readonly<Record<string, Person>> }) {
  const person = event.by === null ? MOVED_BY : people[event.by] ?? FORMER;
  return (
    <li className="constituents-event" data-action={event.action}>
      <div className="constituents-event-head">
        <PersonChip person={person} size="inline" />
        <span>{ACTION_LABEL[event.action]}</span>
        <code>{eventTarget(event, state.constituents)}</code>
        <time dateTime={event.at}>{whenOf(event.at)}</time>
      </div>
      {event.before !== null && <p className="constituents-before"><span className="ask-muted">Before</span> <del>{event.before}</del></p>}
      {event.after !== null && <p className="constituents-after"><span className="ask-muted">After</span> <ins>{event.after}</ins></p>}
      {event.note && <p className="ask-muted">{event.note}</p>}
    </li>
  );
}

export function ConstituentsPanel({ state, product, owner, people, unreadable = false, on = IDLE }: ConstituentsPanelProps) {
  if (product === null) return null;
  const { statement, never, history } = panelOf(state, product);
  return (
    <section className="ask-card business-constituents" aria-labelledby="constituents-title" data-product={product}>
      <header className="constituents-head">
        <h2 id="constituents-title">{CONSTITUENTS_TITLE}</h2>
        <p className="ask-muted">{CONSTITUENTS_LEAD}{owner ? '' : ` ${OWNERS_ONLY}`}</p>
      </header>
      {unreadable
        ? <p className="business-refusal" role="alert">{UNREADABLE}</p>
        : (
          <>
            <StatementBlock statement={statement} state={state} owner={owner} on={on} />
            <NeverList lines={never} state={state} owner={owner} on={on} />
            {state.refusal && <p className="business-refusal" role="alert">{state.refusal}</p>}
            <details className="constituents-history">
              <summary>{HISTORY} · {history.length}</summary>
              {history.length === 0
                ? <p className="ask-muted">{NO_HISTORY}</p>
                : <ol>{history.map((e) => <HistoryEntry key={e.id} event={e} state={state} people={people} />)}</ol>}
            </details>
          </>
        )}
    </section>
  );
}
