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
// (`POST /api/decide/<decision>`), for `omni decide`. Since PRD 871 it reads a repository's product's
// constituents (`GET /api/constituents`), for `omni constituents`.
//
// Every call but the token exchange carries `Authorization: Bearer <access token>`, read from a
// token store keyed by the host of `ask.url`. A 401 refreshes the token once (or takes the tokens
// another terminal renewed meanwhile), keeps the new tokens and retries; a second 401 is an error. Every call has a timeout. Anything but a 2xx, a network
// failure or a timeout is an `AskCallError`, whose `status` is the HTTP status or `null`.
//
// A reply's body is handed on as it came (`unknown`): the client reads only the fields it needs
// itself (the renewed tokens, the `{error}` text), each through a schema; whoever called reads the rest.
import { jsonObject, TokenReplySchema } from './schema.ts';
import type { JsonObject, Tokens } from './schema.ts';
import type { IssueNumber, PrdNumber } from '../ids.ts';

export type { Tokens } from './schema.ts';

/** Where the sign-in of each host is kept: `homeTokens` (`./client-tokens.ts`), or a test's own. */
export type TokenStore = { read(host: string): Tokens | null; write(host: string, tokens: Tokens): void };

/** The `fetch` the client calls through: `globalThis.fetch`, or a test's own, always given a URL. */
export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/** A request's JSON body. */
type Body = Record<string, unknown>;

/** Whether `error` is a timeout's, as `AbortSignal.timeout` throws it. */
const timedOut = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'name' in error && error.name === 'TimeoutError';

/** The calls whose default timeout is not the `wait` call's own. */
export const CALL_TIMEOUT_MS = 5000;
/** How long one proof file's upload may take: a clip is up to 50 MB. */
const UPLOAD_TIMEOUT_MS = 120_000;

export class AskCallError extends Error {
  /** `status`: the server's, null when it could not be reached. `reason`: its `{error}`, when it gave one. */
  status: number | null;
  reason: string | null;

  constructor(message: string, { status = null, reason = null }: { status?: number | null; reason?: string | null } = {}) {
    super(message);
    this.name = 'AskCallError';
    this.status = status;
    this.reason = reason;
  }
}

/** The server's `{error}` text, on one line, or null when the reply carries none. */
const reasonOf = (body: unknown): string | null => {
  const error = jsonObject(body)?.error;
  const text = typeof error === 'string' ? error.replace(/\s+/g, ' ').trim() : '';
  return text || null;
};

/** The fields of a sign-in a renewal keeps: the token reply also says where a repository went
 * (PRD 459), which is no part of the sign-in. */
const SIGN_IN_FIELDS = ['access_token', 'refresh_token', 'expires_at', 'email', 'login'];

/** `current` renewed by `fresh`, the token reply: only the sign-in's own fields are taken. */
const renewed = (current: Tokens, fresh: JsonObject): Tokens => ({
  ...current,
  ...Object.fromEntries(SIGN_IN_FIELDS.filter((key) => fresh[key] !== undefined).map((key) => [key, fresh[key]])),
});

/** `body` with `context` added only when there is one: an older server never sees the field. */
const withContext = (body: Body, context: unknown): Body => (context && typeof context === 'object' ? { ...body, context } : body);

/** `body` with `lead` added only when there is one (PRD 752): an older server never sees the field. */
const withLead = (body: Body, lead: unknown): Body => (typeof lead === 'string' && lead !== '' ? { ...body, lead } : body);

/** The fresh access token's reply, or `null` when it carries none. */
function freshTokens(body: unknown): JsonObject | null {
  const fresh = jsonObject(body);
  return fresh && TokenReplySchema.shape.access_token.safeParse(fresh.access_token).success ? fresh : null;
}

export function askClient({ baseUrl, host, tokens, fetch = globalThis.fetch, callMs = CALL_TIMEOUT_MS }: {
  baseUrl: string;
  host: string;
  tokens: TokenStore;
  fetch?: Fetch | undefined;
  callMs?: number | undefined;
}) {
  const root = baseUrl.replace(/\/+$/, '');
  const segment = (value: string | number): string => encodeURIComponent(value);

  async function send(method: string, path: string, { body, token, timeoutMs }: { body?: unknown; token?: string; timeoutMs: number }): Promise<Response> {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (token) headers.authorization = `Bearer ${token}`;
    try {
      return await fetch(`${root}${path}`, {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new AskCallError(`${method} ${path}: ${timedOut(error) ? 'timed out' : 'unreachable'}`);
    }
  }

  async function bodyOf(response: Response): Promise<unknown> {
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
  async function refresh(current: Tokens): Promise<Tokens | null> {
    const stored = tokens.read(host);
    if (stored?.access_token && stored.access_token !== current.access_token) return stored;
    if (!current.refresh_token) return null;
    let response: Response;
    try {
      response = await send('POST', '/api/ask/token', { body: { refresh_token: current.refresh_token }, timeoutMs: callMs });
    } catch {
      return null;
    }
    if (!response.ok) return null;
    const fresh = freshTokens(await bodyOf(response));
    if (!fresh) return null;
    const kept = renewed(current, fresh);
    tokens.write(host, kept);
    return kept;
  }

  async function call(method: string, path: string, { body, timeoutMs = callMs }: { body?: unknown; timeoutMs?: number } = {}): Promise<unknown> {
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
   */
  async function renew(): Promise<'renewed' | 'refused' | 'unreachable'> {
    const current = tokens.read(host);
    if (!current?.refresh_token) return 'refused';
    let response: Response;
    try {
      response = await send('POST', '/api/ask/token', { body: { refresh_token: current.refresh_token }, timeoutMs: callMs });
    } catch {
      return 'unreachable';
    }
    if (response.status === 401 || response.status === 403) return 'refused';
    if (!response.ok) return 'unreachable';
    const fresh = freshTokens(await bodyOf(response));
    if (!fresh) return 'unreachable';
    tokens.write(host, renewed(current, fresh));
    return 'renewed';
  }

  /**
   * The bytes a screenshot's signed link serves. The link is its own permission: no bearer token goes
   * with it. Anything but a 2xx, a network failure or a timeout is an `AskCallError`.
   */
  async function download(url: string, { timeoutMs = callMs }: { timeoutMs?: number } = {}): Promise<Uint8Array> {
    let response: Response;
    try {
      response = await fetch(url, { method: 'GET', headers: {}, signal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
      throw new AskCallError(`GET a screenshot: ${timedOut(error) ? 'timed out' : 'unreachable'}`);
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
  async function upload(url: string, bytes: BodyInit, type: string, { timeoutMs = UPLOAD_TIMEOUT_MS }: { timeoutMs?: number } = {}): Promise<void> {
    let response: Response;
    try {
      response = await fetch(url, { method: 'PUT', headers: { 'content-type': type }, body: bytes, signal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
      throw new AskCallError(`PUT a proof file: ${timedOut(error) ? 'timed out' : 'unreachable'}`);
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
    openSession: (title: string, context?: unknown) => call('POST', '/api/ask/sessions', { body: withContext({ title }, context) }),
    closeSession: (sessionId: string) => call('POST', `/api/ask/sessions/${segment(sessionId)}/close`),
    /** `questions` is `AskUserQuestion`'s input as is; `context`, when given, is where the round came
     * from and what it cost (`./context.ts`); `lead`, when given, is the text Claude wrote before
     * asking (`./lead.ts`, PRD 752). @returns {Promise<{ roundId: string }>} */
    openRound: (sessionId: string, questions: unknown, context?: unknown, lead?: unknown) =>
      call('POST', `/api/ask/sessions/${segment(sessionId)}/rounds`, { body: withLead(withContext({ questions }, context), lead) }),
    /** Held by the server up to 50 s. An answer given on the page with screenshots (PRD 620) also
     * carries, per question, each one's name and a signed link (null when none could be made).
     * @returns {Promise<{ status: 'open'|'answered'|'abandoned'|'closed', answers?: Record<string, string>,
     *   attachments?: Record<string, Array<{ name: string, url: string | null }>> }>} */
    wait: (roundId: string, { timeoutMs = callMs }: { timeoutMs?: number } = {}) => call('GET', `/api/ask/rounds/${segment(roundId)}/wait`, { timeoutMs }),
    /** An answer given in the terminal. */
    answer: (roundId: string, answers: unknown) => call('POST', `/api/ask/rounds/${segment(roundId)}/answers`, { body: { answers, via: 'terminal' } }),
    abandon: (roundId: string) => call('POST', `/api/ask/rounds/${segment(roundId)}/abandon`),
    /** PRD 459: where the caller's questions for `repo` (owner/name) land — a 404 from a server older
     * than the call. @returns {Promise<{ workspace: { slug: string, name: string } | null, reason: string | null }>} */
    whereQuestionsGo: (repo: string) => call('GET', `/api/ask/workspace?${new URLSearchParams({ repo })}`),
    /** PRD 216: opens a draft dossier for `repo`. The Claude session id is sent only when there is
     * one. @returns {Promise<{ id: string, url: string }>} */
    openDossier: ({ title, repo, claudeSessionId = null }: { title: unknown; repo: unknown; claudeSessionId?: unknown }) =>
      call('POST', '/api/dossiers', { body: { title, repo, ...(claudeSessionId ? { claudeSessionId } : {}) } }),
    /** PRD 216: sends a PRD folder's artifacts, whole; the draft is named only when there is one. Since
     * PRD 627 a fix's push names its kind (visual or bug); a PRD's names none, as before.
     * @returns {Promise<{ id: string, url: string, added: Array<{ kind: string, version: number }>, unchanged: string[] }>} */
    pushDossier: ({ repo, prd, kind = 'prd', title, draftId = null, artifacts }: {
      repo: unknown; prd: unknown; kind?: string | null; title: unknown; draftId?: unknown; artifacts: unknown;
    }) =>
      call('POST', '/api/dossiers/push', {
        body: { repo, prd, ...(kind && kind !== 'prd' ? { kind } : {}), title, ...(draftId ? { draftId } : {}), artifacts },
      }),
    /** PRD 413: PRD `prd`'s dossier for `repo`, as the caller may read it; a 404 when it has none. Since
     * PRD 627, a fix's by its kind (visual or bug). @returns {Promise<{ id: string, url: string }>} */
    /** PRD 757: this Claude session is working on `work` (null: the session alone); `ended` only
     * from the session's end. Answered 204. */
    heartbeat: ({ claudeSessionId, repo, work, ended = false }: { claudeSessionId: unknown; repo: unknown; work: unknown; ended?: boolean }) =>
      call('POST', '/api/ask/heartbeat', { body: { claudeSessionId, repo, work, ...(ended ? { ended: true } : {}) } }),
    // A fix's dossier (`kind` visual or bug) is keyed by its issue, so `prd` is a PRD's number or an issue's.
    findDossier: ({ repo, prd, kind = 'prd' }: { repo: string; prd: PrdNumber | IssueNumber; kind?: string | null }) =>
      call('GET', `/api/dossiers?${new URLSearchParams({ repo, prd: String(prd), ...(kind && kind !== 'prd' ? { kind } : {}) })}`),
    /** PRD 798: a new proof run's id and one signed upload link per file; a 404 when PRD `prd` has no
     * dossier. @returns {Promise<{ run: string, files: Array<{ name: string, path: string, url: string }> }>} */
    requestProofUploads: ({ repo, prd, files }: { repo: unknown; prd: unknown; files: unknown }) => call('POST', '/api/proofs/uploads', { body: { repo, prd, files } }),
    /** PRD 798: stores a proof run once its files are up, and answers the Proof tab's link.
     * @returns {Promise<{ url: string }>} */
    registerProof: ({ repo, prd, run, commit, url, criteria }: { repo: unknown; prd: unknown; run: unknown; commit: unknown; url: unknown; criteria: unknown }) =>
      call('POST', '/api/proofs', { body: { repo, prd, run, commit, url, criteria } }),
    /** PRD 859: a new pitch run's id and one signed upload link per file of the five; a 404 when PRD `prd`
     * has no dossier, a 422 when it is not shipped. @returns {Promise<{ run: string, files: Array<{ name: string, path: string, url: string }> }>} */
    requestPitchUploads: ({ repo, prd, files }: { repo: unknown; prd: unknown; files: unknown }) => call('POST', '/api/pitches/uploads', { body: { repo, prd, files } }),
    /** PRD 859: stores a pitch once its five files are up, and answers the Pitch tab's link and the GIF's
     * stable link. @returns {Promise<{ url: string, gif: string }>} */
    registerPitch: ({ repo, prd, run, audience, look, commit, hook, benefit, kicker, closing }: {
      repo: unknown; prd: unknown; run: unknown; audience: unknown; look: unknown; commit: unknown; hook: unknown; benefit: unknown; kicker: unknown; closing: unknown;
    }) =>
      call('POST', '/api/pitches', { body: { repo, prd, run, audience, look, commit, hook, benefit, kicker, closing } }),
    /** PRD 859: the pitch look of the product `repo` (owner/name) belongs to; arcade when it has none.
     * @returns {Promise<{ look: 'arcade' | 'keynote' }>} */
    readPitchLook: (repo: string) => call('GET', `/api/pitch-look?${new URLSearchParams({ repo })}`),
    /** PRD 748: the confirmed claims of the business agents in `repo` (owner/name) read.
     * @returns {Promise<{ state: 'ok' | 'none', business: { name: string } | null, product: { name: string } | null,
     *   claims: Array<{ id: string, kind: string, value: string, source: string, receipt: string | null, lastSeen: string | null }> }>} */
    readBusiness: (repo: string) => call('GET', `/api/business?${new URLSearchParams({ repo })}`),
    /** PRD 871: the live Statement and Never lines of the product agents in `repo` (owner/name) work on.
     * @returns {Promise<{ state: 'ok' | 'none', product: { name: string } | null, statement: { id: 'statement', text: string } | null,
     *   never: Array<{ id: string, text: string }>, latestEventId: string | null }>} */
    readConstituents: (repo: string) => call('GET', `/api/constituents?${new URLSearchParams({ repo })}`),
    /** PRD 748: appends one citation per claim id (`rival#4`) of the business agents in `repo` read, by
     * `by` (the skill) in the run `ref` (null when none). @returns {Promise<{ cited: number }>} */
    citeClaims: ({ repo, ids, by, ref = null }: { repo: unknown; ids: unknown; by: unknown; ref?: unknown }) => call('POST', '/api/business/citations', { body: { repo, ids, by, ref } }),
    /** PRD 822: stores a claim a person gave as an answer (source `answer`), `proposed` or `confirmed`,
     * for the business agents in `repo` read, its receipt `ref` (the skill and the run).
     * @returns {Promise<{ id: string, state: string, added: boolean }>} */
    addClaim: ({ repo, kind, value, state, ref }: { repo: unknown; kind: unknown; value: unknown; state: unknown; ref: unknown }) => call('POST', '/api/business/claims', { body: { repo, kind, value, state, ref } }),
    /** PRD 812: asks the workspace's Jev decision `decision` for `repo`, given the state and the agent's
     * own answer (`old`); the ref is sent only when there is one.
     * @returns {Promise<{ answer: string | null, confidence: number | null, decidedBy: 'jev' | 'old' }>} */
    decide: ({ decision, repo, state, old, ref = null }: { decision: string; repo: unknown; state: unknown; old: unknown; ref?: unknown }) =>
      call('POST', `/api/decide/${segment(decision)}`, { body: { repo, state, old, ...(ref ? { ref } : {}) } }),
  };
}
