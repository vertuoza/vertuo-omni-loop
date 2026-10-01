// @ts-nocheck
// The ask contract, from the kit's side: one small client over `fetch` for the calls under
// `<ask.url>/api/ask/*` (PRD 71's spec, "The contract"), and since PRD 216 the two dossier calls under
// `<ask.url>/api/dossiers`. The kit knows only this URL and these calls; any server that honours
// them will do. Since PRD 459 it also asks where a repository's questions land (`GET
// /api/ask/workspace`), for `omni ask on` and `omni ask status`. Since PRD 620 it downloads the
// screenshots an answer carries, from the signed links `wait` hands back: those carry no token. Since
// PRD 748 it reads a repository's business (`GET /api/business`), for `omni business show`, and logs
// the claims an agent cited (`POST /api/business/citations`), for `omni business cited`; since PRD 822
// it stores a claim a person answered (`POST /api/business/claims`), for `omni business claim add`. Since
// PRD 757 it says a Claude session is working (`POST /api/ask/heartbeat`). Since PRD 798 it sends a
// proof run: asks for signed upload links (`POST /api/proofs/uploads`), puts each file to its link (a
// signed link carries no token), and registers the run (`POST /api/proofs`). Since PRD 812 it asks a workspace's Jev decision
// (`POST /api/decide/<decision>`), for `omni decide`.
//
// Every call but the token exchange carries `Authorization: Bearer <access token>`, read from a
// token store keyed by the host of `ask.url`. A 401 refreshes the token once (or takes the tokens
// another terminal renewed meanwhile), keeps the new tokens and retries; a second 401 is an error. Every call has a timeout. Anything but a 2xx, a network
// failure or a timeout is an `AskCallError`, whose `status` is the HTTP status or `null`.

/** The calls whose default timeout is not the `wait` call's own. */
export const CALL_TIMEOUT_MS = 5000;
/** How long one proof file's upload may take: a clip is up to 50 MB. */
const UPLOAD_TIMEOUT_MS = 120_000;

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

/** The fields of a sign-in a renewal keeps: the token reply also says where a repository went
 * (PRD 459), which is no part of the sign-in. */
const SIGN_IN_FIELDS = ['access_token', 'refresh_token', 'expires_at', 'email', 'login'];

/** `current` renewed by `fresh`, the token reply: only the sign-in's own fields are taken. */
const renewed = (current, fresh) => ({
  ...current,
  ...Object.fromEntries(SIGN_IN_FIELDS.filter((key) => fresh[key] !== undefined).map((key) => [key, fresh[key]])),
});

/** `body` with `context` added only when there is one: an older server never sees the field. */
const withContext = (body, context) => (context && typeof context === 'object' ? { ...body, context } : body);

/** `body` with `lead` added only when there is one (PRD 752): an older server never sees the field. */
const withLead = (body, lead) => (typeof lead === 'string' && lead !== '' ? { ...body, lead } : body);

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
    const kept = renewed(current, fresh);
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
    tokens.write(host, renewed(current, fresh));
    return 'renewed';
  }

  /**
   * The bytes a screenshot's signed link serves. The link is its own permission: no bearer token goes
   * with it. Anything but a 2xx, a network failure or a timeout is an `AskCallError`.
   * @returns {Promise<Uint8Array>}
   */
  async function download(url, { timeoutMs = callMs } = {}) {
    let response;
    try {
      response = await fetch(url, { method: 'GET', headers: {}, signal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
      throw new AskCallError(`GET a screenshot: ${error?.name === 'TimeoutError' ? 'timed out' : 'unreachable'}`);
    }
    if (!response.ok) throw new AskCallError(`GET a screenshot: ${response.status}`, { status: response.status });
    try {
      return new Uint8Array(await response.arrayBuffer());
    } catch {
      throw new AskCallError('GET a screenshot: cut off');
    }
  }

  /**
   * Puts `bytes` to a signed upload link as `type`. The link is its own permission: no bearer token
   * goes with it. Anything but a 2xx, a network failure or a timeout is an `AskCallError`.
   */
  async function upload(url, bytes, type, { timeoutMs = UPLOAD_TIMEOUT_MS } = {}) {
    let response;
    try {
      response = await fetch(url, { method: 'PUT', headers: { 'content-type': type }, body: bytes, signal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
      throw new AskCallError(`PUT a proof file: ${error?.name === 'TimeoutError' ? 'timed out' : 'unreachable'}`);
    }
    if (!response.ok) {
      const reason = reasonOf(await bodyOf(response));
      throw new AskCallError(`PUT a proof file: ${response.status}`, { status: response.status, reason });
    }
  }

  return {
    renew,
    download,
    upload,
    /** `context`, when given, is `{ repo }` (PRD 144): optional, an older server ignores it.
     * @returns {Promise<{ id: string, url: string }>} */
    openSession: (title, context) => call('POST', '/api/ask/sessions', { body: withContext({ title }, context) }),
    closeSession: (sessionId) => call('POST', `/api/ask/sessions/${segment(sessionId)}/close`),
    /** `questions` is `AskUserQuestion`'s input as is; `context`, when given, is where the round came
     * from and what it cost (`./context.ts`); `lead`, when given, is the text Claude wrote before
     * asking (`./lead.ts`, PRD 752). @returns {Promise<{ roundId: string }>} */
    openRound: (sessionId, questions, context, lead) =>
      call('POST', `/api/ask/sessions/${segment(sessionId)}/rounds`, { body: withLead(withContext({ questions }, context), lead) }),
    /** Held by the server up to 50 s. An answer given on the page with screenshots (PRD 620) also
     * carries, per question, each one's name and a signed link (null when none could be made).
     * @returns {Promise<{ status: 'open'|'answered'|'abandoned'|'closed', answers?: Record<string, string>,
     *   attachments?: Record<string, Array<{ name: string, url: string | null }>> }>} */
    wait: (roundId, { timeoutMs = callMs } = {}) => call('GET', `/api/ask/rounds/${segment(roundId)}/wait`, { timeoutMs }),
    /** An answer given in the terminal. */
    answer: (roundId, answers) => call('POST', `/api/ask/rounds/${segment(roundId)}/answers`, { body: { answers, via: 'terminal' } }),
    abandon: (roundId) => call('POST', `/api/ask/rounds/${segment(roundId)}/abandon`),
    /** PRD 459: where the caller's questions for `repo` (owner/name) land — a 404 from a server older
     * than the call. @returns {Promise<{ workspace: { slug: string, name: string } | null, reason: string | null }>} */
    whereQuestionsGo: (repo) => call('GET', `/api/ask/workspace?${new URLSearchParams({ repo })}`),
    /** PRD 216: opens a draft dossier for `repo`. The Claude session id is sent only when there is
     * one. @returns {Promise<{ id: string, url: string }>} */
    openDossier: ({ title, repo, claudeSessionId = null }) =>
      call('POST', '/api/dossiers', { body: { title, repo, ...(claudeSessionId ? { claudeSessionId } : {}) } }),
    /** PRD 216: sends a PRD folder's artifacts, whole; the draft is named only when there is one. Since
     * PRD 627 a fix's push names its kind (visual or bug); a PRD's names none, as before.
     * @returns {Promise<{ id: string, url: string, added: Array<{ kind: string, version: number }>, unchanged: string[] }>} */
    pushDossier: ({ repo, prd, kind = 'prd', title, draftId = null, artifacts }) =>
      call('POST', '/api/dossiers/push', {
        body: { repo, prd, ...(kind && kind !== 'prd' ? { kind } : {}), title, ...(draftId ? { draftId } : {}), artifacts },
      }),
    /** PRD 413: PRD `prd`'s dossier for `repo`, as the caller may read it; a 404 when it has none. Since
     * PRD 627, a fix's by its kind (visual or bug). @returns {Promise<{ id: string, url: string }>} */
    /** PRD 757: this Claude session is working on `work` (null: the session alone); `ended` only
     * from the session's end. Answered 204. */
    heartbeat: ({ claudeSessionId, repo, work, ended = false }) =>
      call('POST', '/api/ask/heartbeat', { body: { claudeSessionId, repo, work, ...(ended ? { ended: true } : {}) } }),
    findDossier: ({ repo, prd, kind = 'prd' }) =>
      call('GET', `/api/dossiers?${new URLSearchParams({ repo, prd: String(prd), ...(kind && kind !== 'prd' ? { kind } : {}) })}`),
    /** PRD 798: a new proof run's id and one signed upload link per file; a 404 when PRD `prd` has no
     * dossier. @returns {Promise<{ run: string, files: Array<{ name: string, path: string, url: string }> }>} */
    requestProofUploads: ({ repo, prd, files }) => call('POST', '/api/proofs/uploads', { body: { repo, prd, files } }),
    /** PRD 798: stores a proof run once its files are up, and answers the Proof tab's link.
     * @returns {Promise<{ url: string }>} */
    registerProof: ({ repo, prd, run, commit, url, criteria }) =>
      call('POST', '/api/proofs', { body: { repo, prd, run, commit, url, criteria } }),
    /** PRD 748: the confirmed claims of the business agents in `repo` (owner/name) read.
     * @returns {Promise<{ state: 'ok' | 'none', business: { name: string } | null, product: { name: string } | null,
     *   claims: Array<{ id: string, kind: string, value: string, source: string, receipt: string | null, lastSeen: string | null }> }>} */
    readBusiness: (repo) => call('GET', `/api/business?${new URLSearchParams({ repo })}`),
    /** PRD 748: appends one citation per claim id (`rival#4`) of the business agents in `repo` read, by
     * `by` (the skill) in the run `ref` (null when none). @returns {Promise<{ cited: number }>} */
    citeClaims: ({ repo, ids, by, ref = null }) => call('POST', '/api/business/citations', { body: { repo, ids, by, ref } }),
    /** PRD 822: stores a claim a person gave as an answer (source `answer`), `proposed` or `confirmed`,
     * for the business agents in `repo` read, its receipt `ref` (the skill and the run).
     * @returns {Promise<{ id: string, state: string, added: boolean }>} */
    addClaim: ({ repo, kind, value, state, ref }) => call('POST', '/api/business/claims', { body: { repo, kind, value, state, ref } }),
    /** PRD 812: asks the workspace's Jev decision `decision` for `repo`, given the state and the agent's
     * own answer (`old`); the ref is sent only when there is one.
     * @returns {Promise<{ answer: string | null, confidence: number | null, decidedBy: 'jev' | 'old' }>} */
    decide: ({ decision, repo, state, old, ref = null }) =>
      call('POST', `/api/decide/${segment(decision)}`, { body: { repo, state, old, ...(ref ? { ref } : {}) } }),
  };
}
