import type { SubmitEvent } from 'react';
import { CouldNotLoad } from '../dashboard/Notes';
import type { KitToken } from './terminal-tokens.contract';
import {
  atLimit, DEFAULT_DAYS, expiresLabel, madeLabel, SIGNIN_PATH, TERMINAL_LINE, TOKEN_DAYS, TOKEN_NAME_MAX, tokenFormFields, usedLabel,
  type ShownToken, type TerminalState, type TokenDays,
} from './terminal-tokens';

// **Terminal tokens** on your own profile, drawn from its state (PRD 1628 s4; the `profile` screen):
// the line, your live kit tokens newest first (name and ··last four, Made, Used or Never used, Expires,
// and Revoke, which asks to confirm), then Make a token: a name, Expires in 30, 90 or 365 days, and the
// screen's one primary action, which says the limit is reached at 20 live tokens. Right after the
// round trip comes back, the token shown once in a copy field. Drawn on the server first, with no
// token in it; ./TerminalTokens.tsx wires the handlers.

export interface TerminalHandlers {
  confirm(id: string): void;
  keep(): void;
  revoke(id: string): void;
  copy(text: string): void;
  /** The demo's Make a token, with no round trip; null sends the form to the sign-in. */
  make: ((name: string, days: TokenDays) => void) | null;
}

const IDLE: TerminalHandlers = { confirm() {}, keep() {}, revoke() {}, copy() {}, make: null };

export interface TerminalTokensCardProps {
  state: TerminalState;
  /** The workspace's slug, the token acts in. */
  workspace: string;
  /** Where the round trip comes back: your own profile. */
  back: string;
  /** Now, in ms, so the server and the browser say the same Used. */
  now: number;
  demo?: boolean;
  on?: TerminalHandlers;
}

function Row({ token, now, state, on }: { token: KitToken; now: number; state: TerminalState; on: TerminalHandlers }) {
  const confirming = state.confirming === token.id;
  return (
    <li className="terminal-row" data-token={token.id}>
      <span className="terminal-name">{token.name} <span className="terminal-four">{`··${token.lastFour}`}</span></span>
      <span className="terminal-meta">
        <span>{madeLabel(token)}</span>
        <span aria-hidden="true"> · </span>
        <span>{usedLabel(token, now)}</span>
        <span aria-hidden="true"> · </span>
        <span>{expiresLabel(token.expiresAt)}</span>
      </span>
      {confirming
        ? (
          <span className="terminal-confirm" role="group" aria-label={`${TERMINAL_LINE.revoke} ${token.name}?`}>
            <span>{`${TERMINAL_LINE.revoke} ··${token.lastFour}?`}</span>
            <button type="button" className="ask-button quiet terminal-revoke-yes" onClick={() => { on.revoke(token.id); }} disabled={state.busy}>{TERMINAL_LINE.revoke}</button>
            <button type="button" className="ask-button quiet" onClick={() => { on.keep(); }} disabled={state.busy}>{TERMINAL_LINE.keep}</button>
          </span>
        )
        : (
          <button type="button" className="ask-button quiet" aria-label={`${TERMINAL_LINE.revoke} ${token.name}`} onClick={() => { on.confirm(token.id); }} disabled={state.busy}>
            {TERMINAL_LINE.revoke}
          </button>
        )}
    </li>
  );
}

function Shown({ shown, copied, on }: { shown: ShownToken; copied: boolean; on: TerminalHandlers }) {
  return (
    <div className="terminal-shown" role="status">
      <p><strong>{shown.name}</strong>{` · ${TERMINAL_LINE.shownOnce} · ${expiresLabel(shown.expiresAt)}`}</p>
      <div className="terminal-copy">
        <code data-token-shown>{shown.token}</code>
        <button type="button" className="ask-button quiet" onClick={() => { on.copy(shown.token); }}>{copied ? TERMINAL_LINE.copied : TERMINAL_LINE.copy}</button>
      </div>
      <p className="terminal-hint">{`${TERMINAL_LINE.paste} `}<code>{TERMINAL_LINE.pasteVariable}</code>{` ${TERMINAL_LINE.pasteWhere}`}</p>
    </div>
  );
}

function Make({ workspace, back, full, on }: { workspace: string; back: string; full: boolean; on: TerminalHandlers }) {
  const { make } = on;
  const submit = make && ((e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const days = TOKEN_DAYS.find((d) => String(d) === form.get('days')) ?? DEFAULT_DAYS;
    const name = String(form.get('name') ?? '').trim();
    if (name !== '') make(name, days);
  });
  const fields = tokenFormFields(workspace, back);
  return (
    <form className="terminal-make" method="get" action={SIGNIN_PATH} onSubmit={submit ?? undefined}>
      {Object.entries(fields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      <label>
        <span>{TERMINAL_LINE.name}</span>
        <input type="text" name="name" required maxLength={TOKEN_NAME_MAX} placeholder={TERMINAL_LINE.namePlaceholder} disabled={full} />
      </label>
      <label>
        <span>{TERMINAL_LINE.expiresIn}</span>
        <select name="days" defaultValue={String(DEFAULT_DAYS)} disabled={full}>
          {TOKEN_DAYS.map((d) => <option key={d} value={String(d)}>{`${d} days`}</option>)}
        </select>
      </label>
      <button type="submit" className="ask-button" data-primary disabled={full}>{TERMINAL_LINE.make}</button>
      {full && <p className="terminal-limit">{TERMINAL_LINE.limit}</p>}
    </form>
  );
}

export function TerminalTokensCard({ state, workspace, back, now, demo = false, on = IDLE }: TerminalTokensCardProps) {
  let list;
  if (state.tokens === null) list = <CouldNotLoad />;
  else if (state.tokens.length > 0) {
    list = <ul className="terminal-rows" aria-label="Your terminal tokens">{state.tokens.map((t) => <Row key={t.id} token={t} now={now} state={state} on={on} />)}</ul>;
  }
  return (
    <section className="profile-work terminal-tokens" aria-labelledby="profile-terminal">
      <h2 id="profile-terminal">{TERMINAL_LINE.title}</h2>
      <p className="profile-line">{TERMINAL_LINE.intro}</p>
      {demo && <p className="profile-alert-hint">{TERMINAL_LINE.demo}</p>}
      {list}
      <Make workspace={workspace} back={back} full={atLimit(state)} on={on} />
      {state.refusal && <p className="profile-alert-message" role="alert">{state.refusal}</p>}
      {state.shown && <Shown shown={state.shown} copied={state.copied} on={on} />}
    </section>
  );
}
