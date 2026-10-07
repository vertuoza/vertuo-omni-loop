import type { SubmitEvent } from 'react';
import type { JevDecisionSettings, JevMode } from '../store';
import { RECORD_DAYS, type DecisionRecord, type Disagreement, type JevRecords, type RefLink } from '../record/record';
import { dayOf, decisionLines, maskedKey, MODE_LABELS, savedOn, tuningText, type DecisionLine, type JevState } from './model';

// Settings › Jev's key part drawn from its state (PRD 812 s1). The owner reads the Jev switch: Off
// opens the key field, where a pasted key is tested with one call before it is saved, and a refused
// test shows TypeSafe's reason; On shows the key's last four, Replace key and what switching off does.
// A member reads whether Jev is on, and never the key, its last four or a control. Drawn on the server
// first; JevPage.tsx wires the handlers.
//
// Below the key, one row per decision (PRD 812 s2): what it decides, what it sends, its mode (Off,
// Shadow, On), its threshold and its confidence floor. The owner saves each row on its own; Shadow and
// On need Jev on. A member reads them. A decision whose slice has not landed says it is coming.
//
// Under each row, its record over the last 30 days (PRD 812 s4, ../record/record.ts), the same for the
// owner and a member: the calls, how often Jev agreed with today's path, and the last ten
// disagreements with both answers and a link to the round or the issue (a ref it cannot link is shown
// as text). An Off decision with no calls says Jev is not called.

export const ONLY_OWNER = 'Only @owner can change Jev’s settings.';
export const SENDS = 'Once a decision is switched on, its text is sent to TypeSafe AI, the company behind Jev, tokens masked. Every decision starts Off.';
export const SWITCH_OFF = 'Switching Jev off removes the key and sets every decision Off.';
const COMING_LABEL = 'Coming in this PRD';
const NEEDS_KEY = 'Switch Jev on above to put a decision in Shadow or On.';
const OFF_NOT_CALLED = 'Off: Jev is not called';
const NO_CALLS = `No calls to Jev in the last 30 days.`;
const RECORD_UNREADABLE = 'The record could not be read. Reload in a moment.';
const MODES_HELP = 'Off: today’s path decides and Jev is not called. Shadow: today’s path decides and Jev’s answer is only logged. On: Jev decides, and today’s path whenever Jev cannot or answers under the floor.';

export interface JevHandlers {
  edit: () => void;
  cancel: () => void;
  save: (key: string) => void;
  remove: () => void;
  saveDecision: (settings: JevDecisionSettings) => void;
}

const IDLE: JevHandlers = { edit() {}, cancel() {}, save() {}, remove() {}, saveDecision() {} };

export interface JevViewProps {
  state: JevState;
  owner: boolean;
  on?: JevHandlers;
  /** Each decision's record (PRD 812 s4); null when it could not be read, none in the demo. */
  records?: JevRecords | null | undefined;
}

function KeyForm({ state, on }: { state: JevState; on: JevHandlers }) {
  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get('key');
    if (typeof value === 'string' && value.trim()) on.save(value);
  };
  return (
    <form className="jev-key-form" onSubmit={submit}>
      <label className="jev-key-label">
        <span>TypeSafe API key</span>
        <input className="jev-key-input" type="password" name="key" autoComplete="off" spellCheck={false} required disabled={state.busy} />
      </label>
      <p className="ask-muted jev-sends">{SENDS}</p>
      <div className="jev-actions">
        <button type="submit" className="ask-button" disabled={state.busy}>{state.busy ? 'Testing…' : 'Test and save'}</button>
        <button type="button" className="ask-button quiet" onClick={on.cancel} disabled={state.busy}>Cancel</button>
      </div>
    </form>
  );
}

function OwnerKey({ state, on }: { state: JevState; on: JevHandlers }) {
  const { key } = state;
  const date = savedOn(key);
  return (
    <>
      {key.stored && !state.editing && (
        <div className="jev-stored">
          <p className="jev-key-line">API key <code className="jev-last-four">{maskedKey(key)}</code>{date && <span className="ask-muted"> · saved {date}</span>}</p>
          <button type="button" className="ask-button quiet" onClick={on.edit} disabled={state.busy}>Replace key</button>
          <p className="ask-muted">{SWITCH_OFF}</p>
        </div>
      )}
      {state.editing && <KeyForm state={state} on={on} />}
      {!key.stored && !state.editing && <p className="ask-muted">Switch Jev on and paste your TypeSafe API key. It is tested with one call, stored encrypted, and never shown again.</p>}
    </>
  );
}

const MODES: readonly JevMode[] = ['off', 'shadow', 'on'];

function DecisionForm({ line, state, on }: { line: DecisionLine; state: JevState; on: JevHandlers }) {
  const { settings } = line;
  const saving = state.savingDecision === settings.decision;
  const busy = state.savingDecision !== null;
  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const mode = form.get('mode');
    on.saveDecision({
      decision: settings.decision,
      // The select offers only MODES; readDecision checks the mode again on the server.
      mode: MODES.find((m) => m === mode) ?? settings.mode,
      threshold: Number(form.get('threshold')),
      floor: Number(form.get('floor')),
    });
  };
  const id = (field: string) => `jev-${settings.decision}-${field}`;
  return (
    <form className="jev-decision-form" onSubmit={submit} key={JSON.stringify(settings)}>
      <label className="jev-field" htmlFor={id('mode')}>
        <span>Mode</span>
        <select id={id('mode')} name="mode" defaultValue={settings.mode} disabled={busy}>
          {MODES.map((mode) => (
            <option key={mode} value={mode} disabled={mode !== 'off' && !state.key.stored}>{MODE_LABELS[mode]}</option>
          ))}
        </select>
      </label>
      <label className="jev-field" htmlFor={id('threshold')}>
        <span>Threshold</span>
        <input id={id('threshold')} className="jev-number" type="number" name="threshold" min={0} max={1} step={0.05} defaultValue={tuningText(settings.threshold)} required disabled={busy} />
      </label>
      <label className="jev-field" htmlFor={id('floor')}>
        <span>Confidence floor</span>
        <input id={id('floor')} className="jev-number" type="number" name="floor" min={0} max={1} step={0.05} defaultValue={tuningText(settings.floor)} required disabled={busy} />
      </label>
      <button type="submit" className="ask-button" disabled={busy}>{saving ? 'Saving…' : 'Save'}</button>
    </form>
  );
}

function DecisionReadOnly({ settings }: { settings: JevDecisionSettings }) {
  return (
    <p className="jev-decision-settings">
      <span>Mode <strong>{MODE_LABELS[settings.mode]}</strong></span>
      <span>Threshold <strong>{tuningText(settings.threshold)}</strong></span>
      <span>Confidence floor <strong>{tuningText(settings.floor)}</strong></span>
    </p>
  );
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function Ref({ link }: { link: RefLink }) {
  if (!link.href) return <span className="jev-ref">{link.text}</span>;
  const away = link.href.startsWith('https://');
  return <a className="jev-ref" href={link.href} {...(away ? { rel: 'noreferrer', target: '_blank' } : {})}>{link.text}</a>;
}

function DisagreementLine({ d }: { d: Disagreement }) {
  return (
    <li>
      {dayOf(d.calledAt) ?? d.calledAt}
      {' · '}Jev <strong>{d.jevAnswer}</strong>{d.confidence !== null && ` (${tuningText(d.confidence)})`}
      {' · '}today’s path <strong>{d.oldAnswer}</strong>
      {d.decidedBy === 'jev' && ' · Jev decided'}
      {d.ref && <>{' · '}<Ref link={d.ref} /></>}
    </li>
  );
}

/** A decision's record over the last 30 days (PRD 812 s4): what the page read, or why there is none. */
function DecisionRecordBlock({ record, mode }: { record: DecisionRecord | null; mode: JevMode }) {
  return (
    <div className="jev-record">
      {record === null && <p className="ask-muted">{RECORD_UNREADABLE}</p>}
      {record?.calls === 0 && <p className="ask-muted">{mode === 'off' ? OFF_NOT_CALLED : NO_CALLS}</p>}
      {record && record.calls > 0 && (
        <>
          <p className="jev-record-line">
            Last {RECORD_DAYS} days: {plural(record.calls, 'call', 'calls')}
            {' · '}
            {record.agreement === null
              ? 'no answer to compare yet'
              : `Jev agreed with today’s path ${plural(record.agreed, 'time', 'times')} out of ${record.compared} (${Math.round(record.agreement * 100)}%)`}
          </p>
          {record.disagreements.length > 0 && (
            <>
              <p className="ask-muted jev-record-title">Last disagreements</p>
              <ol className="jev-disagreements">
                {record.disagreements.map((d, i) => <DisagreementLine key={`${d.calledAt}-${i}`} d={d} />)}
              </ol>
            </>
          )}
        </>
      )}
    </div>
  );
}

const EMPTY_RECORD: DecisionRecord = { calls: 0, compared: 0, agreed: 0, agreement: null, disagreements: [] };

/** The refusal the last save of this decision met, if any. */
const refusalFor = (state: JevState, name: string) =>
  state.decisionRefusal?.decision === name ? state.decisionRefusal.message : null;

/** This decision's record: null when the calls could not be read, empty when it has none. */
const recordFor = (records: JevRecords | null | undefined, name: string) =>
  records === null ? null : records?.[name] ?? EMPTY_RECORD;

function DecisionRow({ line, state, owner, on, records }: { line: DecisionLine; state: JevState; owner: boolean; on: JevHandlers; records: JevRecords | null | undefined }) {
  const { row, ready } = line;
  const refusal = refusalFor(state, row.name);
  return (
    <li className="jev-decision" data-decision={row.name}>
      <div className="jev-decision-head">
        <h3>{row.title}</h3>
        {!ready && <span className="jev-coming">{COMING_LABEL}</span>}
      </div>
      <p className="ask-muted jev-about">{row.about}</p>
      <p className="ask-muted jev-sends">Sends: {row.sends}</p>
      {refusal && <p className="jev-refusal" role="alert">{refusal}</p>}
      {owner && ready ? <DecisionForm line={line} state={state} on={on} /> : <DecisionReadOnly settings={line.settings} />}
      <DecisionRecordBlock record={recordFor(records, row.name)} mode={line.settings.mode} />
    </li>
  );
}

function Decisions({ state, owner, on, records }: { state: JevState; owner: boolean; on: JevHandlers; records: JevRecords | null | undefined }) {
  return (
    <section className="ask-card jev-decisions" aria-labelledby="jev-decisions-title">
      <h2 id="jev-decisions-title">Decisions</h2>
      <p className="ask-muted">{MODES_HELP}</p>
      <p className="ask-muted">A Noul answer at or above the threshold counts as yes. Under the confidence floor, an On decision keeps today’s answer.</p>
      {owner && !state.key.stored && <p className="ask-muted">{NEEDS_KEY}</p>}
      <ul className="jev-decision-list">
        {decisionLines(state).map((line) => <DecisionRow key={line.row.name} line={line} state={state} owner={owner} on={on} records={records} />)}
      </ul>
    </section>
  );
}

export function JevView({ state, owner, on = IDLE, records }: JevViewProps) {
  const stored = state.key.stored;
  return (
    <div className="ask-col jev">
      <section className="ask-card jev-head" aria-labelledby="jev-title">
        <h1 id="jev-title">Jev</h1>
        <p className="ask-muted">Jev, by TypeSafe AI, answers typed questions with a confidence and writes no text. Your workspace can hand it some of the loop’s decisions, one at a time.</p>
        {!owner && <p className="ask-muted">{ONLY_OWNER}</p>}
      </section>

      <section className="ask-card jev-key" aria-labelledby="jev-key-title">
        <div className="jev-key-head">
          <h2 id="jev-key-title">Jev by TypeSafe AI</h2>
          <div className="jev-switch">
            <button
              type="button"
              role="switch"
              aria-checked={stored}
              aria-label="Jev for this workspace"
              className="jev-toggle"
              onClick={stored ? on.remove : on.edit}
              disabled={!owner || state.busy || (!stored && state.editing)}
            />
            <span>{stored ? 'On' : 'Off'}</span>
          </div>
        </div>
        {state.refusal && <p className="jev-refusal" role="alert">{state.refusal}</p>}
        {owner
          ? <OwnerKey state={state} on={on} />
          : <p className="ask-muted">{stored ? 'Jev is on for this workspace.' : 'Jev is off for this workspace.'}</p>}
      </section>

      <Decisions state={state} owner={owner} on={on} records={records} />
    </div>
  );
}
