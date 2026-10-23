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
// constituents (`GET /api/constituents`), for `omni constituents`. Since PRD 1108 it reads a
// repository's product's Pitch settings (`GET /api/pitch-settings`), for `omni pitch start`. Since
// PRD 1139 it pushes where a loop stands (`POST /api/loops`), for `omni loop push`. Since PRD 1299 it
// reads a PRD's approval in force (`GET /api/dossiers/approval`), for `omni approval`. Since PRD 1322 it
// asks a PRD's approvers (`POST /api/dossiers/approval/request`) and follows its approval as Server-Sent
// Events (`GET /api/dossiers/approval/stream`, the one call whose body is a stream), for `omni wait approval`.
// Since PRD 1548 it reads, raises and settles a product PRD's outbox items (`/api/outbox/items`), for the
// outbox's `server` store. Since PRD 1665 it reads the loop's state (`GET /api/loop/*`), for the
// `LoopReads` port (`../loop-reads/`).
//
// Every call but the token exchange carries `Authorization: Bearer <access token>`, read from a
// token store keyed by the host of `ask.url`. A 401 refreshes the token once (or takes the tokens
// another terminal renewed meanwhile), keeps the new tokens and retries; a second 401 is an error. Every call has a timeout. Anything but a 2xx, a network
// failure or a timeout is an `AskCallError`, whose `status` is the HTTP status or `null`.
//
// With a kit token (`OMNI_TOKEN`, PRD 1628), the store carries it as `omniToken`: the client trades it
// (`POST /api/ask/token {omni_token}`) for an access token on first use, keeps that in the store (in
// memory), and trades again when it has under a minute left or a call answers 401. A token that does
// not work is an `AskCallError` whose message is its one line, naming the variable, never its value.
//
// A reply's body is handed on as it came (`unknown`): the client reads only the fields it needs
// itself (the renewed tokens, the `{error}` text), each through a schema; whoever called reads the rest.
import { jsonObject, TokenReplySchema } from './schema.ts';
import type { JsonObject, Tokens } from './schema.ts';
import type { IssueNumber, PrdNumber, ProductPrdId } from '../ids.ts';

export type { Tokens } from './schema.ts';

/**
 * Where the sign-in of each host is kept: `homeTokens` (`./client-tokens.ts`), or a test's own.
 * `omniToken`, on the kit token's store, is the token every access token is traded for.
 */
export type TokenStore = { read(host: string): Tokens | null; write(host: string, tokens: Tokens): void; omniToken?: string | undefined };

/** The `fetch` the client calls through: `globalThis.fetch`, or a test's own, always given a URL. */
export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/** A request's JSON body. */
type Body = Record<string, unknown>;

/** Whether `error` is a timeout's, as `AbortSignal.timeout` throws it. */
const timedOut = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'name' in error && error.name === 'TimeoutError';

/** The calls whose default timeout is not the `wait` call's own. */
export const CALL_TIMEOUT_MS = 5000;
/** How long a knowledge pack's read may take: it carries a whole knowledge folder. */
const PACK_TIMEOUT_MS = 30_000;

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

/** How long before its expiry a traded access token is traded again. */
const TRADE_MARGIN_MS = 60_000;

/** Whether `tokens` is past its `expires_at` (seconds as the page gives it, or milliseconds) less the margin. */
function stale({ expires_at: at }: Tokens, now: number): boolean {
  if (typeof at !== 'number') return false;
  return (at < 1e12 ? at * 1000 : at) - TRADE_MARGIN_MS <= now;
}

/** A date the page gave (seconds, milliseconds or text) as `yyyy-mm-dd`, or `null`. */
function dayOf(value: unknown): string | null {
  const ms = typeof value === 'number' ? (value < 1e12 ? value * 1000 : value) : typeof value === 'string' ? Date.parse(value) : Number.NaN;
  return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : null;
}

/** A workspace's name, given as `{name}` or as text, or `null`. */
function workspaceName(value: unknown): string | null {
  const name = typeof value === 'string' ? value : jsonObject(value)?.name;
  return typeof name === 'string' && name !== '' ? name : null;
}

const MAKE_ANOTHER = 'make a new one with omni setup-token';

/** The one line a refused kit token stops on (spec, section 4), from the exchange's 401 `{error, reason}`. */
function refusalLine(body: unknown, host: string): string {
  const reply = jsonObject(body) ?? {};
  if (reply.reason === 'expired') {
    const day = dayOf(reply.expires_at);
    return `OMNI_TOKEN expired${day ? ` on ${day}` : ''}: ${MAKE_ANOTHER}`;
  }
  if (reply.reason === 'revoked') return `OMNI_TOKEN was revoked: ${MAKE_ANOTHER}`;
  if (reply.reason === 'not-a-member') {
    const login = typeof reply.login === 'string' && reply.login !== '' ? reply.login : 'its maker';
    return `OMNI_TOKEN: ${login} is no longer a member of ${workspaceName(reply.workspace) ?? 'its workspace'}`;
  }
  return `OMNI_TOKEN is not known to ${host}: ${MAKE_ANOTHER}`;
}

/** The fresh access token's reply, or `null` when it carries none. */
function freshTokens(body: unknown): JsonObject | null {
  const fresh = jsonObject(body);
  return fresh && TokenReplySchema.shape.access_token.safeParse(fresh.access_token).success ? fresh : null;
}

export function askClient({ baseUrl, host, tokens, fetch = globalThis.fetch, callMs = CALL_TIMEOUT_MS, now = Date.now }: {
  baseUrl: string;
  host: string;
  tokens: TokenStore;
  fetch?: Fetch | undefined;
  callMs?: number | undefined;
  now?: (() => number) | undefined;
}) {
  const root = baseUrl.replace(/\/+$/, '');
  const segment = (value: string | number): string => encodeURIComponent(value);

  /** One request. `signal`, when given, replaces the timeout: a stream's body outlives `timeoutMs`. */
  async function send(method: string, path: string, { body, token, timeoutMs, accept = 'application/json', extra = {}, signal }: {
    body?: unknown; token?: string; timeoutMs: number; accept?: string; extra?: Record<string, string>; signal?: AbortSignal | undefined;
  }): Promise<Response> {
    const headers: Record<string, string> = { accept, ...extra };
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (token) headers.authorization = `Bearer ${token}`;
    try {
      return await fetch(`${root}${path}`, {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: signal ?? AbortSignal.timeout(timeoutMs),
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

  /**
   * Trades the kit token for an access token, kept in the store: `repo`, when given, goes with it, for
   * the reply to say where its calls go. Throws an `AskCallError` carrying the token's one line.
   */
  async function trade(omniToken: string, repo: string | null = null): Promise<{ tokens: Tokens; reply: JsonObject }> {
    let response: Response;
    try {
      response = await send('POST', '/api/ask/token', { body: repo ? { omni_token: omniToken, repo } : { omni_token: omniToken }, timeoutMs: callMs });
    } catch {
      throw new AskCallError(`OMNI_TOKEN: cannot reach ${host}: allow it in your environment's network access`);
    }
    const body = await bodyOf(response);
    if (response.status === 401) throw new AskCallError(refusalLine(body, host), { status: 401, reason: reasonOf(body) });
    if (!response.ok) {
      const reason = reasonOf(body);
      throw new AskCallError(`OMNI_TOKEN: ${host} answered ${response.status}${reason ? `: ${reason}` : ''}`, { status: response.status, reason });
    }
    const fresh = freshTokens(body);
    if (!fresh) throw new AskCallError(`OMNI_TOKEN: ${host} answered with no access token`, { status: response.status });
    const kept = renewed({ access_token: '' }, fresh);
    tokens.write(host, kept);
    return { tokens: kept, reply: fresh };
  }

  /** The sign-in a call goes with: the kit token's access token, traded first when it is stale. */
  async function currentTokens(): Promise<Tokens | null> {
    const held = tokens.read(host);
    if (tokens.omniToken && (!held?.access_token || stale(held, now()))) return (await trade(tokens.omniToken)).tokens;
    return held;
  }

  /** A 2xx response to an authorized request: a 401 refreshes the sign-in (or trades the kit token) once and retries. */
  async function authorized(method: string, path: string, options: { body?: unknown; timeoutMs: number; accept?: string; extra?: Record<string, string>; signal?: AbortSignal }): Promise<Response> {
    const current = await currentTokens();
    if (!current?.access_token) throw new AskCallError(`not signed in to ${host}`);
    let response = await send(method, path, { ...options, token: current.access_token });
    if (response.status === 401) {
      const fresh = tokens.omniToken ? (await trade(tokens.omniToken)).tokens : await refresh(current);
      if (!fresh) throw new AskCallError(`${method} ${path}: sign-in refused`, { status: 401 });
      response = await send(method, path, { ...options, token: fresh.access_token });
    }
    if (!response.ok) {
      const reason = reasonOf(await bodyOf(response));
      throw new AskCallError(`${method} ${path}: ${response.status}${reason ? ` ${reason}` : ''}`, { status: response.status, reason });
    }
    return response;
  }

  async function call(method: string, path: string, { body, timeoutMs = callMs }: { body?: unknown; timeoutMs?: number } = {}): Promise<unknown> {
    return bodyOf(await authorized(method, path, { body, timeoutMs }));
  }

  /**
   * Opens a Server-Sent Events stream: the response once its headers arrive, its body left to read.
   * Connecting may take `callMs`; the body then lasts until the server closes it or `signal` aborts.
   * `lastEventId`, when given, goes as `Last-Event-ID`, for the server to replay what came after it.
   */
  async function stream(path: string, { lastEventId, signal }: { lastEventId: string | null; signal: AbortSignal }): Promise<Response> {
    const connect = new AbortController();
    const timer = setTimeout(() => { connect.abort(); }, callMs);
    try {
      return await authorized('GET', path, {
        timeoutMs: callMs,
        accept: 'text/event-stream',
        extra: lastEventId === null ? {} : { 'last-event-id': lastEventId },
        signal: AbortSignal.any([signal, connect.signal]),
      });
    } finally {
      clearTimeout(timer);
    }
  }

  /** Renews the kit token's access token now, as `renew` says how it went. */
  async function renewByToken(omniToken: string): Promise<'renewed' | 'refused' | 'unreachable'> {
    try {
      await trade(omniToken);
      return 'renewed';
    } catch (error) {
      const status = error instanceof AskCallError ? error.status : null;
      return status === 401 || status === 403 ? 'refused' : 'unreachable';
    }
  }

  /**
   * Renews the stored sign-in now: `renewed` (the new tokens are kept), `refused` (the server no
   * longer honours it) or `unreachable`.
   */
  async function renew(): Promise<'renewed' | 'refused' | 'unreachable'> {
    if (tokens.omniToken) return renewByToken(tokens.omniToken);
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

  /**
   * Signs in with the kit token now (`omni signin`, `omni whoami` under `OMNI_TOKEN`): who it signs in
   * as and, with `repo`, where its calls go (`workspace`, or the page's `reason`). Throws the token's
   * `AskCallError`; without a kit token, an `AskCallError` too.
   */
  async function tradeToken({ repo = null }: { repo?: string | null } = {}) {
    if (!tokens.omniToken) throw new AskCallError(`no OMNI_TOKEN to sign in to ${host} with`);
    const { reply } = await trade(tokens.omniToken, repo);
    const text = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);
    const workspace = jsonObject(reply.workspace);
    const name = text(workspace?.name);
    return {
      login: text(reply.login),
      email: text(reply.email),
      workspace: name ? { slug: text(workspace?.slug), name } : null,
      reason: name ? null : text(reply.reason),
    };
  }

  return {
    renew,
    tradeToken,
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
    /** PRD 1180: a round opened already answered in the terminal, in one call, for a question the pre
     * hook could not open on the page. An older server opens it unanswered and answers `{ roundId }`
     * alone. @returns {Promise<{ roundId: string, status?: 'answered', via?: 'terminal' }>} */
    openAnswered: (sessionId: string, questions: unknown, answers: unknown, context?: unknown, lead?: unknown) =>
      call('POST', `/api/ask/sessions/${segment(sessionId)}/rounds`, { body: withLead(withContext({ questions, answers, via: 'terminal' }, context), lead) }),
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
     * PRD 627 a fix's push names its kind (visual or bug), and since PRD 1272 a concept's (concept); a
     * PRD's names none, as before. Since PRD 1364 a PRD's push names its product when one was chosen.
     * @returns {Promise<{ id: string, url: string, added: Array<{ kind: string, version: number }>, unchanged: string[], product?: string | null }>} */
    pushDossier: ({ repo, prd, kind = 'prd', title, draftId = null, product = null, artifacts }: {
      repo: unknown; prd: unknown; kind?: string | null; title: unknown; draftId?: unknown; product?: string | null; artifacts: unknown;
    }) =>
      call('POST', '/api/dossiers/push', {
        body: { repo, prd, ...(kind && kind !== 'prd' ? { kind } : {}), title, ...(draftId ? { draftId } : {}), ...(product ? { product } : {}), artifacts },
      }),
    /** PRD 1548: sends a product PRD's files — to the product keyed `key`'s next PRD, created, when `seq`
     * is null, else to PRD `<key>-<seq>`. `repo`, the repository the kit runs from, only chooses between
     * two workspaces holding the key. @returns {Promise<{ id: string, prdId: string, url: string,
     *   added: Array<{ kind: string, version: number }>, unchanged: string[], product: string | null }>} */
    pushProductDossier: ({ key, seq, repo, title, artifacts }: { key: string; seq: number | null; repo: string | null; title: string; artifacts: unknown }) =>
      call('POST', '/api/dossiers/push', {
        body: { productKey: key, ...(seq === null ? { new: true } : { prd: seq }), ...(repo ? { repo } : {}), title, artifacts },
      }),
    /** PRD 1548: product PRD `<key>-<seq>`'s dossier, its title and its product; a 404 when there is none.
     * @returns {Promise<{ id: string, url: string, prdId: string, title: string | null, product: string | null }>} */
    findProductDossier: ({ key, seq, repo }: { key: string; seq: number; repo: string | null }) =>
      call('GET', `/api/dossiers?${new URLSearchParams({ product: key, prd: String(seq), ...(repo ? { repo } : {}) })}`),
    /** PRD 1548: product PRD `id`'s (`mobile-12`) approval in force, with its page's link, as `readApproval`'s
     * reply; `repo` only chooses between two workspaces holding the key. A 404 when there is no such PRD. */
    readProductApproval: ({ id, repo }: { id: ProductPrdId; repo: string | null }) =>
      call('GET', `/api/dossiers/approval?${new URLSearchParams({ prd: id, ...(repo ? { repo } : {}) })}`),
    /** PRD 1548: product PRD `<key>-<seq>`'s latest version of `kind`, whole; a 404 when it has none.
     * @returns {Promise<{ id: string, prdId: string, url: string, kind: string, version: number, sha256: string,
     *   content: string, createdAt: string }>} */
    getDossier: ({ key, seq, kind, repo }: { key: string; seq: number; kind: string; repo: string | null }) =>
      call('GET', `/api/dossiers/get?${new URLSearchParams({ product: key, prd: String(seq), kind, ...(repo ? { repo } : {}) })}`),
    /** PRD 1548 s7: product PRD `<key>-<seq>`'s outbox items, each with its settlement or none; a 404 when
     * there is no such PRD. `../outbox/server-store.ts` reads the reply. */
    readOutboxItems: ({ key, seq, repo }: { key: string; seq: number; repo: string | null }) =>
      call('GET', `/api/outbox/items?${new URLSearchParams({ product: key, prd: String(seq), ...(repo ? { repo } : {}) })}`),
    /** PRD 1548 s7: raises the item `body` on product PRD `<key>-<seq>`, or rewrites it while it is open;
     * with `adopt`, a medium item adopted at once. */
    putOutboxItem: ({ key, seq, repo, body, adopt }: { key: string; seq: number; repo: string | null; body: string; adopt: boolean }) =>
      call('POST', '/api/outbox/items', { body: { product: key, prd: seq, ...(repo ? { repo } : {}), body, ...(adopt ? { adopt } : {}) } }),
    /** PRD 1548 s7: settles product PRD `<key>-<seq>`'s open item with an answer given in the terminal. */
    settleOutboxItem: ({ key, seq, repo, item, verdict, basis, answer }: {
      key: string; seq: number; repo: string | null; item: string; verdict: string; basis: string; answer: string;
    }) => call('POST', '/api/outbox/items/settle', { body: { product: key, prd: seq, ...(repo ? { repo } : {}), item, verdict, basis, answer } }),
    /** PRD 413: PRD `prd`'s dossier for `repo`, as the caller may read it; a 404 when it has none. Since
     * PRD 627, a fix's by its kind (visual or bug), and since PRD 1272 a concept's. Since PRD 1364 it answers
     * the dossier's product by its name, or null. @returns {Promise<{ id: string, url: string, product?: string | null }>} */
    /** PRD 757: this Claude session is working on `work` (null: the session alone); `ended` only
     * from the session's end. Answered 204. */
    heartbeat: ({ claudeSessionId, repo, work, ended = false }: { claudeSessionId: unknown; repo: unknown; work: unknown; ended?: boolean }) =>
      call('POST', '/api/ask/heartbeat', { body: { claudeSessionId, repo, work, ...(ended ? { ended: true } : {}) } }),
    // A fix's or a concept's dossier (`kind` visual, bug or concept) is keyed by its issue, so `prd` is a PRD's number or an issue's.
    findDossier: ({ repo, prd, kind = 'prd' }: { repo: string; prd: PrdNumber | IssueNumber; kind?: string | null }) =>
      call('GET', `/api/dossiers?${new URLSearchParams({ repo, prd: String(prd), ...(kind && kind !== 'prd' ? { kind } : {}) })}`),
    /** PRD 1299: PRD `prd`'s approval in force for `repo` (owner/name), with its dossier's link; a 404
     * when it has no dossier. `../approval/approval.ts` reads the reply.
     * @returns {Promise<{ url: string, approval: { approver: { login: string, member: boolean }, approvedAt: string,
     *   files: Array<{ kind: string, path: string, sha256: string, versionId: string, content?: string }> } | null }>} */
    readApproval: ({ repo, prd }: { repo: string; prd: PrdNumber }) =>
      call('GET', `/api/dossiers/approval?${new URLSearchParams({ repo, prd: String(prd) })}`),
    /** PRD 1322: asks PRD `prd`'s approvers for `repo` (owner/name) to approve, by each one's
     * channels, and answers who was asked; `../approval/stream.ts` reads the reply (`AskingSchema`).
     * @returns {Promise<{ asked: Array<{ login: string, name?: string | null }>, nobodyElse: boolean,
     *   author: string, product: string | null }>} */
    requestApproval: ({ repo, prd }: { repo: string; prd: PrdNumber }) =>
      call('POST', '/api/dossiers/approval/request', { body: { repo, prd: Number(prd) } }),
    /** PRD 1322: PRD `prd`'s approval events for `repo` (owner/name), as Server-Sent Events, after
     * `lastEventId` when given; `../approval/stream.ts` reads them. */
    streamApproval: ({ repo, prd, lastEventId, signal }: { repo: string; prd: PrdNumber; lastEventId: string | null; signal: AbortSignal }) =>
      stream(`/api/dossiers/approval/stream?${new URLSearchParams({ repo, prd: String(prd) })}`, { lastEventId, signal }),
    /** PRD 1299: where `repo`'s (owner/name) new PRDs are born, `pr` or `server`, as its row on the Omni
     * page says. `../approval/flag.ts` reads the reply. @returns {Promise<{ phase0: 'pr' | 'server' }>} */
    readPhase0Flag: (repo: string) => call('GET', `/api/repositories/phase0?${new URLSearchParams({ repo })}`),
    /** PRD 1364: the repository links of the product named `product`, in the workspace that lists the
     * plan repository `repo` (owner/name); `../product/targets.ts` reads the reply.
     * @returns {Promise<{ product: { name: string }, targets: Array<{ repo: string, role: string | null, knowledge: string,
     *   readAt: string | null, readOnly: boolean, consumes: string[] }> }>} */
    readProductTargets: ({ repo, product }: { repo: string; product: string }) =>
      call('GET', `/api/products/targets?${new URLSearchParams({ repo, product })}`),
    /** PRD 1364: links each of `targets` to the product named `product`, in the workspace that lists the
     * plan repository `repo` (owner/name), adding or changing each link; `../product/import.ts` reads
     * the reply. @returns {Promise<{ product: { name: string }, added: string[], changed: string[], unchanged: string[] }>} */
    importProductTargets: ({ repo, product, targets }: { repo: string; product: string; targets: unknown }) =>
      call('POST', '/api/products/import', { body: { repo, product, targets } }),
    /** PRD 2011: the newest knowledge pack of `repo` (owner/name), or the one of commit `sha`, as the caller
     * reads it; a 404 when the caller's workspace holds none. `../knowledge/packs/store.ts` reads the reply. */
    readKnowledgePack: ({ repo, sha }: { repo: string; sha?: string | undefined }) =>
      call('GET', `/api/knowledge-packs?${new URLSearchParams({ repo, ...(sha === undefined ? {} : { sha }) })}`, { timeoutMs: PACK_TIMEOUT_MS }),
    /** PRD 1364: the products `repo` (owner/name) is in; `../product/import.ts` reads the reply.
     * @returns {Promise<{ products: Array<{ name: string }> }>} */
    readProductsOf: (repo: string) => call('GET', `/api/products/which?${new URLSearchParams({ repo })}`),
    /** PRD 798: a new proof run's id and one signed upload link per file; a 404 when PRD `prd` has no
     * dossier. @returns {Promise<{ run: string, files: Array<{ name: string, path: string, url: string }> }>} */
    requestProofUploads: ({ repo, prd, kind, files }: { repo: unknown; prd: unknown; kind?: unknown; files: unknown }) =>
      call('POST', '/api/proofs/uploads', { body: { repo, prd, ...(kind === undefined ? {} : { kind }), files } }),
    /** PRD 798: stores a proof run once its files are up, and answers the Proof tab's link.
     * @returns {Promise<{ url: string }>} */
    registerProof: ({ repo, prd, kind, run, commit, url, criteria }: { repo: unknown; prd: unknown; kind?: unknown; run: unknown; commit: unknown; url: unknown; criteria: unknown }) =>
      call('POST', '/api/proofs', { body: { repo, prd, ...(kind === undefined ? {} : { kind }), run, commit, url, criteria } }),
    /** PRD 859: a new pitch run's id and one signed upload link per file of the five; a 404 when PRD `prd`
     * has no dossier, a 422 when it is not shipped. @returns {Promise<{ run: string, files: Array<{ name: string, path: string, url: string }> }>} */
    requestPitchUploads: ({ repo, prd, files }: { repo: unknown; prd: unknown; files: unknown }) => call('POST', '/api/pitches/uploads', { body: { repo, prd, files } }),
    /** PRD 859: stores a pitch once its five files are up, and answers the Pitch tab's link and the GIF's
     * stable link. @returns {Promise<{ url: string, gif: string }>} */
    registerPitch: ({ repo, prd, run, audience, look, commit, hook, benefit, kicker, closing }: {
      repo: unknown; prd: unknown; run: unknown; audience: unknown; look: unknown; commit: unknown; hook: unknown; benefit: unknown; kicker: unknown; closing: unknown;
    }) =>
      call('POST', '/api/pitches', { body: { repo, prd, run, audience, look, commit, hook, benefit, kicker, closing } }),
    /** PRD 1108: the Pitch settings of the product `repo` (owner/name) belongs to, filled from its preset
     * and the defaults. @returns {Promise<{ settings: unknown }>} */
    readPitchSettings: (repo: string) => call('GET', `/api/pitch-settings?${new URLSearchParams({ repo })}`),
    /** PRD 748: the confirmed claims of the business agents in `repo` (owner/name) read.
     * @returns {Promise<{ state: 'ok' | 'none', business: { name: string } | null, product: { name: string } | null,
     *   claims: Array<{ id: string, kind: string, value: string, source: string, receipt: string | null, lastSeen: string | null }> }>} */
    readBusiness: (repo: string) => call('GET', `/api/business?${new URLSearchParams({ repo })}`),
    /** PRD 871: the live Statement and Never lines of the product agents in `repo` (owner/name) work on.
     * @returns {Promise<{ state: 'ok' | 'none', product: { name: string } | null, statement: { id: 'statement', text: string } | null,
     *   never: Array<{ id: string, text: string }>, latestEventId: string | null }>} */
    readConstituents: (repo: string) => call('GET', `/api/constituents?${new URLSearchParams({ repo })}`),
    /** PRD 2417: the tech playbook of the settings repository of the workspace `repo` (owner/name) belongs to, as the
     * caller; `../omni-settings/schema.ts` shapes the answer, and `../omni-settings/sync.ts` reads it. */
    readOmniSettings: (repo: string) => call('GET', `/api/omni-settings/playbook?${new URLSearchParams({ repo })}`),
    /** PRD 2268: adds or edits one Legal entry or Glossary term of the product `repo` belongs to (`product`, when
     * the repository is in several), as the caller: the section's owner saves it, any other member proposes it.
     * `entry` names the item an edit changes, by the id or term the reads print.
     * @returns {Promise<{ done: 'applied' | 'proposed', id?: string, url: string, owner?: string }>} */
    changeKnowledge: ({ repo, product, kind, action, entry, fields }: {
      repo: string; product?: string | undefined; kind: 'legal' | 'glossary' | 'constituent'; action: 'add' | 'edit'; entry?: string | undefined; fields: Record<string, unknown>;
    }) =>
      call('POST', '/api/knowledge/changes', {
        body: { repo, ...(product === undefined ? {} : { product }), kind, action, ...(entry === undefined ? {} : { entry }), fields },
      }),
    /** PRD 1665: one of the loop's reads, `path` under `/api/loop/` (`changes`, `changes/<n>`, `comments`,
     * `issues`, `issues/<n>`) with its query (`repo` and its filters); `../loop-reads/omni.ts` reads the answer. */
    readLoop: (path: string, query: Record<string, string>) => call('GET', `/api/loop/${path}?${new URLSearchParams(query)}`),
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
    /** PRD 1139: one push of a loop (`../loop/body.ts` shapes it), sent as it is.
     * @returns {Promise<{ loopId: string, state: 'running' | 'parked' | 'stopped', planVersion: number }>} */
    pushLoop: (body: unknown) => call('POST', '/api/loops', { body }),
    /** PRD 1162: one push of a roadmap (`../roadmap/push.ts` shapes it), sent as it is.
     * @returns {Promise<{ roadmapId: string, created: boolean, product: unknown, unknownProduct: string | null, note: string | null }>} */
    pushRoadmap: (body: unknown) => call('POST', '/api/roadmaps', { body }),
    /** PRD 1798, s5: the neighbourhood of node `id` in product `key`'s knowledge graph, `depth` (1 to 3) hops, as the caller. */
    readKnowledgeGraph: ({ key, id, depth }: { key: string; id: string; depth: number | null }) =>
      call('GET', `/api/products/${encodeURIComponent(key)}/knowledge/graph?${new URLSearchParams(depth === null ? { id } : { id, depth: String(depth) })}`),
    /** PRD 1798: one repository's knowledge graph at one commit (`../knowledge/graph-push.ts` builds it), sent as it is.
     * @returns {Promise<{ repo: string, commit: string, nodes: number, edges: number, products: Array<{ key: string | null, href: string }> }>} */
    pushKnowledgeGraph: ({ repo, commit, graph }: { repo: string; commit: string; graph: unknown }) =>
      call('POST', '/api/knowledge/graphs', { body: { repo, commit, graph }, timeoutMs: UPLOAD_TIMEOUT_MS }),
    /** PRD 2011: one push of a product bug record, or its check (`../bug/product.ts` shapes it), sent as it is.
     * @returns {Promise<{ dossierId: string, bug: string, created: boolean, rows: unknown[], added: unknown[], unchanged: string[] }>} */
    pushBug: (body: unknown) => call('POST', '/api/fixes', { body }),
    /** PRD 2410: a PRD's watch on main, its breaks and the rewind's findings, as the caller (`omni rewind facts`). */
    readRewind: ({ repo, prd }: { repo: string; prd: PrdNumber }) =>
      call('GET', `/api/rewind/facts?${new URLSearchParams({ repo, prd: String(prd) })}`),
    /** PRD 2410: sends the rewind's findings for PRD `prd` of `repo` (`omni rewind push`).
     * @returns {Promise<{ added: number }>} */
    pushRewind: ({ repo, prd, findings }: { repo: string; prd: PrdNumber; findings: unknown }) =>
      call('POST', '/api/rewind/findings', { body: { repo, prd, findings } }),
    /** PRD 1246: adds an idea to `repo`'s board (owner/name), for a member of the workspace that lists
     * it. @returns {Promise<{ id: string, url: string }>} */
    addIdea: ({ repo, title, pitch, lane }: { repo: string; title: string; pitch: string; lane: string }) =>
      call('POST', '/api/ideas', { body: { repo, title, pitch, lane } }),
    /** PRD 1246: `repo`'s board (owner/name), its ideas lane by lane, as a member of its workspace reads it.
     * @returns {Promise<{ repo: string, url: string, ideas: Array<{ id: string, title: string, pitch: string,
     *   lane: 'now' | 'next' | 'later', prd: number | null, votes: number }> }>} */
    listIdeas: (repo: string) => call('GET', `/api/ideas?${new URLSearchParams({ repo })}`),
  };
}
