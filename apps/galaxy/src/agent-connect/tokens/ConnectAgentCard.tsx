import type { SubmitEvent } from 'react';
import { dayLabel, lastUsedLabel, makerLabel, setupsOf, TOKEN_NAME_MAX, type AgentToken } from './model';
import type { Shown, TokensState } from './state';

// Settings › Business › Connect an agent drawn from its state (PRD 855 s1). A name field and Make link;
// once made, the token shown once with the setup for Cursor, Claude Code and any MCP client, each with
// Copy, and Done, which forgets it; then the workspace's links, newest first: name, who made it, when,
// when an agent last read through it and its last four characters, with Revoke on the viewer's own (on
// every link for an owner). A link whose maker left the workspace says it no longer works. Drawn on the
// server first; ConnectAgent.tsx wires the handlers.

export interface TokensHandlers {
  name(name: string): void;
  make(): void;
  revoke(token: AgentToken): void;
  copy(label: string, text: string): void;
  done(): void;
}

const IDLE: TokensHandlers = { name() {}, make() {}, revoke() {}, copy() {}, done() {} };

export const CONNECT_TITLE = 'Connect an agent';
const CONNECT_HINT = 'A read-only link for an editor’s agent, in Cursor, Claude Code or any MCP client: it reads the business’s confirmed claims, so the agent knows who you sell to before it writes a line.';
export const MAKE_LINK = 'Make link';
const NAME_LABEL = 'The link’s name';
const NAME_PLACEHOLDER = 'Tom’s editor';
export const SHOWN_ONCE = 'Copy it now: this token is shown once, and never again.';
export const DONE = 'Done — I copied it';
export const NO_LINKS = 'No link yet. Make one for each editor, and revoke it when the editor goes.';
export const REVOKE = 'Revoke';
export const NOT_WORKING = 'Not working: its maker left the workspace.';
const COPY = 'Copy';
const COPIED = 'Copied';

export interface ConnectAgentCardProps {
  state: TokensState;
  demo?: boolean;
  on?: TokensHandlers;
}

function TokenShown({ shown, copied, on }: { shown: Shown; copied: string | null; on: TokensHandlers }) {
  return (
    <div className="agent-shown" role="status">
      <p className="agent-shown-lead"><strong>{shown.name}</strong> · {SHOWN_ONCE}</p>
      <code className="agent-token" data-token-shown>{shown.token}</code>
      <ul className="agent-setups">
        {setupsOf(shown.url, shown.token).map((s) => (
          <li key={s.label} className="agent-setup" data-setup={s.label}>
            <div className="agent-setup-head">
              <strong>{s.label}</strong>
              <span className="ask-muted">{s.where}</span>
              <button type="button" className="ask-button quiet" onClick={() => { on.copy(s.label, s.text); }}>{copied === s.label ? COPIED : COPY}</button>
            </div>
            <pre>{s.text}</pre>
          </li>
        ))}
      </ul>
      <button type="button" className="ask-button" onClick={() => { on.done(); }}>{DONE}</button>
    </div>
  );
}

function TokenRow({ token, busy, on }: { token: AgentToken; busy: boolean; on: TokensHandlers }) {
  return (
    <li className="agent-row" data-token={token.id} data-mine={token.mine ? 'true' : 'false'}>
      <div className="agent-row-main">
        <strong>{token.name}</strong>
        <span className="agent-row-meta">
          <span>{token.mine ? 'made by you' : `made by ${makerLabel(token)}`}</span>
          <span>created {dayLabel(token.createdAt)}</span>
          <span>{lastUsedLabel(token)}</span>
          <code>…{token.lastFour}</code>
        </span>
        {!token.working && <span className="agent-row-dead">{NOT_WORKING}</span>}
      </div>
      {token.canRevoke && (
        <button type="button" className="ask-button quiet" aria-label={`${REVOKE} ${token.name}`} onClick={() => { on.revoke(token); }} disabled={busy}>{REVOKE}</button>
      )}
    </li>
  );
}

export function ConnectAgentCard({ state, demo = false, on = IDLE }: ConnectAgentCardProps) {
  const submit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    on.make();
  };
  return (
    <section className="ask-card agent-connect" aria-labelledby="agent-connect-title">
      <div className="agent-connect-head">
        <h2 id="agent-connect-title">{CONNECT_TITLE}</h2>
        {demo && <span className="ask-chip">Demo</span>}
      </div>
      <p className="ask-muted">{CONNECT_HINT}</p>
      <form className="agent-make business-type" onSubmit={submit}>
        <label>
          <span className="agent-make-label">{NAME_LABEL}</span>
          <input
            type="text" name="name" maxLength={TOKEN_NAME_MAX} placeholder={NAME_PLACEHOLDER} value={state.name}
            onChange={(e) => { on.name(e.target.value); }} disabled={state.busy}
          />
        </label>
        <button type="submit" className="ask-button" disabled={state.busy || state.name.trim() === ''}>{MAKE_LINK}</button>
      </form>
      {state.refusal && <p className="business-refusal" role="alert">{state.refusal}</p>}
      {state.shown && <TokenShown shown={state.shown} copied={state.copied} on={on} />}
      {state.tokens.length === 0
        ? <p className="ask-muted agent-none">{NO_LINKS}</p>
        : <ul className="agent-list" aria-label="The workspace’s links">{state.tokens.map((t) => <TokenRow key={t.id} token={t} busy={state.busy} on={on} />)}</ul>}
    </section>
  );
}
