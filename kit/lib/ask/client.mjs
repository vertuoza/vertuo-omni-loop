// The ask contract, from the kit's side: one small client over `fetch` for the calls under
// `<ask.url>/api/ask/*` (PRD 71's spec, "The contract"), and since PRD 216 the two dossier calls under
// `<ask.url>/api/dossiers`. The kit knows only this URL and these calls; any server that honours
// them will do.
//
// Every call but the token exchange carries `Authorization: Bearer <access token>`, read from a
// token store keyed by the host of `ask.url`. A 401 refreshes the token once (or takes the tokens
// another terminal renewed meanwhile), keeps the new tokens and retries; a second 401 is an error. Every call has a timeout. Anything but a 2xx, a network
// failure or a timeout is an `AskCallError`, whose `status` is the HTTP status or `null`.

/** The calls whose default timeout is not the `wait` call's own. */
export const CALL_TIMEOUT_MS = 5000;

export class AskCallError extends Error {
  /** `status`: the server's, null when it could not be reached. `reason`: its `{error}`, when it gave one. */
  constructor(message, { status = null, reason = null } = {}) {
    super(message);
    this.name = 'AskCallError';
    this.status = status;
    this.reason = reason;
  }
}

/** The server's `{error}` text, on one line, or null when the reply carries none. */
const reasonOf = (body) => {
  const text = typeof body?.error === 'string' ? body.error.replace(/\s+/g, ' ').trim() : '';
  return text || null;
};

/** `body` with `context` added only when there is one: an older server never sees the field. */
const withContext = (body, context) => (context && typeof context === 'object' ? { ...body, context } : body);

/**
 * @typedef {{ access_token: string, refresh_token?: string, expires_at?: number, email?: string }} Tokens
 * @typedef {{ read(host: string): Tokens | null, write(host: string, tokens: Tokens): void }} TokenStore
 */

/**
 * @param {{ baseUrl: string, host: string, tokens: TokenStore, fetch?: typeof globalThis.fetch, callMs?: number }} options
 */
export function askClient({ baseUrl, host, tokens, fetch = globalThis.fetch, callMs = CALL_TIMEOUT_MS }) {
  const root = baseUrl.replace(/\/+$/, '');
  const segment = (value) => encodeURIComponent(value);

  async function send(method, path, { body, token, timeoutMs }) {
    const headers = { accept: 'application/json' };
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (token) headers.authorization = `Bearer ${token}`;
    try {
      return await fetch(`${root}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new AskCallError(`${method} ${path}: ${error?.name === 'TimeoutError' ? 'timed out' : 'unreachable'}`);
    }
  }

  async function bodyOf(response) {
    const text = await response.text().catch(() => '');
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  }

  /**
   * The new tokens, kept in the store, or `null` when there is no refresh token or it is refused.
   * The store is read again first: when another terminal has renewed the sign-in since `current` was
   * read, its tokens are taken as they are. Replaying a refresh token that was already rotated makes
   * the sign-in server revoke the whole sign-in.
   */
  async function refresh(current) {
    const stored = tokens.read(host);
    if (stored?.access_token && stored.access_token !== current.access_token) return stored;
    if (!current.refresh_token) return null;
    let response;
    try {
      response = await send('POST', '/api/ask/token', { body: { refresh_token: current.refresh_token }, timeoutMs: callMs });
    } catch {
      return null;
    }
    if (!response.ok) return null;
    const fresh = await bodyOf(response);
    if (typeof fresh.access_token !== 'string' || !fresh.access_token) return null;
    const kept = { ...current, ...fresh };
    tokens.write(host, kept);
    return kept;
  }

  async function call(method, path, { body, timeoutMs = callMs } = {}) {
    const current = tokens.read(host);
    if (!current?.access_token) throw new AskCallError(`not signed in to ${host}`);
    let response = await send(method, path, { body, token: current.access_token, timeoutMs });
    if (response.status === 401) {
      const fresh = await refresh(current);
      if (!fresh) throw new AskCallError(`${method} ${path}: sign-in refused`, { status: 401 });
      response = await send(method, path, { body, token: fresh.access_token, timeoutMs });
    }
    if (!response.ok) {
      const reason = reasonOf(await bodyOf(response));
      throw new AskCallError(`${method} ${path}: ${response.status}${reason ? ` ${reason}` : ''}`, { status: response.status, reason });
    }
    return bodyOf(response);
  }

  /**
   * Renews the stored sign-in now: `renewed` (the new tokens are kept), `refused` (the server no
   * longer honours it) or `unreachable`.
   * @returns {Promise<'renewed' | 'refused' | 'unreachable'>}
   */
  async function renew() {
    const current = tokens.read(host);
    if (!current?.refresh_token) return 'refused';
    let response;
    try {
      response = await send('POST', '/api/ask/token', { body: { refresh_token: current.refresh_token }, timeoutMs: callMs });
    } catch {
      return 'unreachable';
    }
    if (response.status === 401 || response.status === 403) return 'refused';
    if (!response.ok) return 'unreachable';
    const fresh = await bodyOf(response);
    if (typeof fresh.access_token !== 'string' || !fresh.access_token) return 'unreachable';
    tokens.write(host, { ...current, ...fresh });
    return 'renewed';
  }

  return {
    renew,
    /** `context`, when given, is `{ repo }` (PRD 144): optional, an older server ignores it.
     * @returns {Promise<{ id: string, url: string }>} */
    openSession: (title, context) => call('POST', '/api/ask/sessions', { body: withContext({ title }, context) }),
    closeSession: (sessionId) => call('POST', `/api/ask/sessions/${segment(sessionId)}/close`),
    /** `questions` is `AskUserQuestion`'s input as is; `context`, when given, is where the round came
     * from and what it cost (`./context.mjs`). @returns {Promise<{ roundId: string }>} */
    openRound: (sessionId, questions, context) =>
      call('POST', `/api/ask/sessions/${segment(sessionId)}/rounds`, { body: withContext({ questions }, context) }),
    /** Held by the server up to 50 s. @returns {Promise<{ status: 'open'|'answered'|'abandoned'|'closed', answers?: Record<string, string> }>} */
    wait: (roundId, { timeoutMs = callMs } = {}) => call('GET', `/api/ask/rounds/${segment(roundId)}/wait`, { timeoutMs }),
    /** An answer given in the terminal. */
    answer: (roundId, answers) => call('POST', `/api/ask/rounds/${segment(roundId)}/answers`, { body: { answers, via: 'terminal' } }),
    abandon: (roundId) => call('POST', `/api/ask/rounds/${segment(roundId)}/abandon`),
    /** PRD 216: opens a draft dossier for `repo`. The Claude session id is sent only when there is
     * one. @returns {Promise<{ id: string, url: string }>} */
    openDossier: ({ title, repo, claudeSessionId = null }) =>
      call('POST', '/api/dossiers', { body: { title, repo, ...(claudeSessionId ? { claudeSessionId } : {}) } }),
    /** PRD 216: sends a PRD folder's artifacts, whole; the draft is named only when there is one.
     * @returns {Promise<{ id: string, url: string, added: Array<{ kind: string, version: number }>, unchanged: string[] }>} */
    pushDossier: ({ repo, prd, title, draftId = null, artifacts }) =>
      call('POST', '/api/dossiers/push', { body: { repo, prd, title, ...(draftId ? { draftId } : {}), artifacts } }),
    /** PRD 413: PRD `prd`'s dossier for `repo`, as the caller may read it; a 404 when it has none.
     * @returns {Promise<{ id: string, url: string }>} */
    findDossier: ({ repo, prd }) =>
      call('GET', `/api/dossiers?${new URLSearchParams({ repo, prd: String(prd) })}`),
  };
}
