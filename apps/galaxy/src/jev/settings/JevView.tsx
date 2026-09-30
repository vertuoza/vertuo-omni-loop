import type { FormEvent } from 'react';
import { maskedKey, savedOn, type JevState } from './model';

// Settings › Jev's key part drawn from its state (PRD 812 s1). The owner reads the Jev switch: Off
// opens the key field, where a pasted key is tested with one call before it is saved, and a refused
// test shows TypeSafe's reason; On shows the key's last four, Replace key and what switching off does.
// A member reads whether Jev is on, and never the key, its last four or a control. Drawn on the server
// first; JevPage.tsx wires the handlers. The decision rows come in PRD 812 s2.

export const ONLY_OWNER = 'Only @owner can change Jev’s settings.';
export const SENDS = 'Once a decision is switched on, its text is sent to TypeSafe AI, the company behind Jev, tokens masked. Every decision starts Off.';
export const SWITCH_OFF = 'Switching Jev off removes the key and sets every decision Off.';

export interface JevHandlers {
  edit(): void;
  cancel(): void;
  save(key: string): void;
  remove(): void;
}

const IDLE: JevHandlers = { edit() {}, cancel() {}, save() {}, remove() {} };

export interface JevViewProps {
  state: JevState;
  owner: boolean;
  on?: JevHandlers;
}

function KeyForm({ state, on }: { state: JevState; on: JevHandlers }) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
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

export function JevView({ state, owner, on = IDLE }: JevViewProps) {
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
    </div>
  );
}
