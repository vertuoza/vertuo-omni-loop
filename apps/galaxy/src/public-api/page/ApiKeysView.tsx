import type { SubmitEvent } from 'react';
import { API_KEY_NAME_MAX, type ApiKey } from '../keys/api-keys.contract';
import { API_REFERENCE_HREF, canMake, dayOf, lastUsedOf, makerOf, maskedKey, repoChip, type ApiKeysState } from './model';

// Settings › API keys drawn from the panel's state (PRD 2022 s1; the `api-keys` screen of the design
// library). The title with New key for an owner, the API reference link, then the key just made, once:
// its whole secret with Copy, "You will not see this key again." and a `curl`; then the workspace's live
// keys, one row each: name, who made it and when, `oma_…<last four>`, its repositories (All
// repositories, or one chip each), when it was last used, and Revoke for an owner, asked twice. A member
// sees the table without the buttons, and why. Drawn on the server first; ApiKeysPanel.tsx wires it.

export interface ApiKeysHandlers {
  open(): void;
  close(): void;
  name(name: string): void;
  all(all: boolean): void;
  repo(repo: string, on: boolean): void;
  make(): void;
  copy(): void;
  confirm(key: ApiKey): void;
  cancel(): void;
  revoke(key: ApiKey): void;
}

const IDLE: ApiKeysHandlers = {
  open() {}, close() {}, name() {}, all() {}, repo() {}, make() {}, copy() {}, confirm() {}, cancel() {}, revoke() {},
};

const TITLE = 'API keys';
export const NEW_KEY = 'New key';
export const API_REFERENCE = 'API reference';
export const ALL_REPOSITORIES = 'All repositories';
export const NO_KEY_YET = 'No key yet.';
export const NOT_AGAIN = 'You will not see this key again.';
export const ONLY_OWNERS = 'Only owners make or revoke keys.';
export const REVOKE = 'Revoke';
export const REVOKE_FOR_GOOD = 'Revoke for good';
export const NOT_WORKING = 'Its maker left the workspace: it no longer works.';
const LEAD = 'A key lets another tool call this workspace’s API: read its PRDs and bug fixes, and start a bug fix. It acts for the whole workspace, or only on the repositories you pick.';
const MAKE_KEY = 'Make key';
const CANCEL = 'Cancel';
const KEEP = 'Keep';
const COPY = 'Copy';
const COPIED = 'Copied';

export interface ApiKeysViewProps {
  state: ApiKeysState;
  owner: boolean;
  /** The repositories an owner may limit a key to. */
  tracked: readonly string[];
  now: Date;
  demo?: boolean;
  on?: ApiKeysHandlers;
}

function NewKeyForm({ state, tracked, on }: { state: ApiKeysState; tracked: readonly string[]; on: ApiKeysHandlers }) {
  const submit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    on.make();
  };
  return (
    <form className="api-keys-form" aria-label={NEW_KEY} onSubmit={submit}>
      <label className="api-keys-field">
        <span>Name</span>
        <input type="text" name="name" maxLength={API_KEY_NAME_MAX} placeholder="QA dashboard" value={state.form.name}
          onChange={(e) => { on.name(e.target.value); }} disabled={state.busy} />
      </label>
      <fieldset className="api-keys-repos" disabled={state.busy}>
        <legend>Repositories</legend>
        <label><input type="radio" name="scope" checked={state.form.all} onChange={() => { on.all(true); }} /> {ALL_REPOSITORIES}</label>
        <label><input type="radio" name="scope" checked={!state.form.all} onChange={() => { on.all(false); }} disabled={tracked.length === 0} /> Only these:</label>
        {!state.form.all && (
          <ul className="api-keys-picks">
            {tracked.map((repo) => (
              <li key={repo}>
                <label><input type="checkbox" name="repos" value={repo} checked={state.form.repos.includes(repo)} onChange={(e) => { on.repo(repo, e.target.checked); }} /> <code>{repo}</code></label>
              </li>
            ))}
          </ul>
        )}
      </fieldset>
      <div className="api-keys-actions">
        <button type="submit" className="ask-button" disabled={!canMake(state)}>{MAKE_KEY}</button>
        <button type="button" className="ask-button quiet" onClick={() => { on.close(); }} disabled={state.busy}>{CANCEL}</button>
      </div>
    </form>
  );
}

function MadeKey({ state, on }: { state: ApiKeysState; on: ApiKeysHandlers }) {
  if (!state.made) return null;
  return (
    <section className="api-keys-made" role="status" aria-label={`The key ${state.made.name}`}>
      <strong>{state.made.name}</strong>
      <div className="api-keys-secret">
        <code data-secret>{state.made.secret}</code>
        <button type="button" className="ask-button" onClick={() => { on.copy(); }}>{state.copied ? COPIED : COPY}</button>
      </div>
      <p className="ask-muted">{NOT_AGAIN}</p>
      <pre>{state.made.curl}</pre>
    </section>
  );
}

function Repos({ repos }: { repos: readonly string[] }) {
  if (repos.length === 0) return <span className="ask-muted">{ALL_REPOSITORIES}</span>;
  return <span className="api-keys-chips">{repos.map((r) => <span key={r} className="api-keys-chip" title={r}>{repoChip(r)}</span>)}</span>;
}

function KeyRow({ apiKey, state, owner, now, on }: { apiKey: ApiKey; state: ApiKeysState; owner: boolean; now: Date; on: ApiKeysHandlers }) {
  const asking = state.confirming === apiKey.id;
  return (
    <tr data-key={apiKey.id} data-working={apiKey.working ? 'true' : 'false'}>
      <td>
        <strong className="api-keys-name">{apiKey.name}</strong>
        <span className="api-keys-meta">{makerOf(apiKey)} · {dayOf(apiKey.createdAt)}</span>
        {!apiKey.working && <span className="api-keys-dead">{NOT_WORKING}</span>}
      </td>
      <td><code className="api-keys-masked">{maskedKey(apiKey)}</code></td>
      <td><Repos repos={apiKey.repos} /></td>
      <td className="ask-muted"><span className="api-keys-label">Last used </span>{lastUsedOf(apiKey.lastUsedAt, now)}</td>
      {owner && (
        <td className="api-keys-revoke">
          {asking
            ? (
              <span className="api-keys-confirm">
                <button type="button" className="ask-button" onClick={() => { on.revoke(apiKey); }} disabled={state.busy}>{REVOKE_FOR_GOOD}</button>
                <button type="button" className="ask-button quiet" onClick={() => { on.cancel(); }} disabled={state.busy}>{KEEP}</button>
              </span>
            )
            : <button type="button" className="ask-button quiet" aria-label={`${REVOKE} ${apiKey.name}`} onClick={() => { on.confirm(apiKey); }} disabled={state.busy}>{REVOKE}</button>}
        </td>
      )}
    </tr>
  );
}

function KeysTable({ state, owner, now, on }: { state: ApiKeysState; owner: boolean; now: Date; on: ApiKeysHandlers }) {
  if (state.keys.length === 0) return <p className="api-keys-empty">{NO_KEY_YET}</p>;
  return (
    <table className="api-keys-table" aria-label="The workspace’s API keys">
      <thead>
        <tr><th scope="col">Name</th><th scope="col">Key</th><th scope="col">Repositories</th><th scope="col">Last used</th>{owner && <th scope="col"><span className="api-keys-hidden">{REVOKE}</span></th>}</tr>
      </thead>
      <tbody>
        {state.keys.map((k) => <KeyRow key={k.id} apiKey={k} state={state} owner={owner} now={now} on={on} />)}
      </tbody>
    </table>
  );
}

export function ApiKeysView({ state, owner, tracked, now, demo = false, on = IDLE }: ApiKeysViewProps) {
  return (
    <div className="api-keys" data-screen="api-keys">
      <div className="api-keys-head">
        <h1 id="api-keys-title">{TITLE}</h1>
        {demo && <span className="ask-chip">Demo</span>}
        {owner && !state.form.open && (
          <button type="button" className={state.made ? 'ask-button quiet' : 'ask-button'} onClick={() => { on.open(); }} disabled={state.busy}>{NEW_KEY}</button>
        )}
      </div>
      <p className="ask-muted api-keys-lead">{LEAD} <a href={API_REFERENCE_HREF}>{API_REFERENCE}</a></p>
      {!owner && <p className="api-keys-owners">{ONLY_OWNERS}</p>}
      {owner && state.form.open && <NewKeyForm state={state} tracked={tracked} on={on} />}
      {state.refusal && <p className="api-keys-refusal" role="alert">{state.refusal}</p>}
      <MadeKey state={state} on={on} />
      <KeysTable state={state} owner={owner} now={now} on={on} />
    </div>
  );
}
