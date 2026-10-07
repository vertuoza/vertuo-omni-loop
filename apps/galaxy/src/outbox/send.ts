// Ported from archive/outbox-answers-v1:apps/galaxy/src/outbox/send.ts (PRD 251, s11). The outbox is no
// longer stored: each pick is checked against a fresh read through PRD 426's GitHub reader.
//
// Send posts the reply as the person (PRD 251, "Send posts the reply as you"), as three plain functions
// of a Request, so they are tested with a fake store, a fake reader and a fake GitHub, and the routes
// stay one line each:
//
//   POST /api/outbox/send  {dossier, picks}         → 200 {send, authorize, dropped}  + the nonce cookie
//   GET  /prd/github/callback?code&state            → 303 back to the dossier's Outbox tab (&send=<id>)
//   GET  /api/outbox/send?id=<send>                 → 200 the send's outcome, as the tab shows it
//
// 1. startSend, as the signed-in person, who must be a member of the dossier's workspace (row-level
//    security: another workspace's dossier reads as none). The outbox is read fresh from GitHub, not from
//    the reader's cache; each pick is checked against it — a pick whose question is no longer open or
//    adopted was settled meanwhile and is dropped, and the answer says which — then the kit's reply
//    writer writes the reply, and it is recorded as a send (a row of outbox_sends only its owner reads).
//    The answer is the address of GitHub's authorisation of the omni-loop App; its `state` names the send
//    and carries a nonce, which a short-lived, http-only cookie also carries, only as far as the
//    callback. Only the nonce's hash is stored.
// 2. finishSend: the send must be the caller's, not yet posted, and the nonce must match the cookie and
//    the stored hash; otherwise nothing is posted and nothing recorded. The code is traded for a user
//    token, the reply is posted on the feature pull request with it, the token is dropped, and the
//    comment's link and author — or the error — are recorded on the send, once. Once posted, the
//    dossier's cached summary is cleared, so the answer shows as pending at once, and its PRD's open
//    questions are recounted into prd_outbox (PRD 657, s5), which /prd reads; a recount that fails is
//    logged, and the person still lands on the tab. The token is never stored, logged or sent to the
//    browser. GitHub takes a code once, so a replayed callback cannot post
//    a second time even before the outcome is recorded.
//
// The comment is the person's own, so `omni replies` counts it like any other when GitHub lists them as
// OWNER, MEMBER or COLLABORATOR; otherwise the send is recorded as uncounted and the tab says so.
import 'server-only';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { writeReply } from 'vertuo-omni-plan/kit/lib/outbox/answers.ts';
import { WRITER_ASSOCIATIONS } from 'vertuo-omni-plan/kit/lib/outbox/replies.ts';
import { defined, group, messageOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { requestOrigin } from '../ask/page/sign-in';
import type { DossierRef } from '../dossier/github/reader';
import { UNREAD, type GithubSummary } from '../dossier/github/summary';
import { sentView, type SendErrorCode, type SendRow } from './sent';
import type { PrdNumber, PrNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';

export type { SendRow } from './sent';

/** Where GitHub sends the person back after authorising the omni-loop App. */
export const sendCallbackPath = '/prd/github/callback';

/** The cookie that carries a send's nonce to the callback, and no further. */
export const NONCE_COOKIE = 'omni-send-nonce';
const NONCE_MAX_AGE = 600;

const AUTHORIZE = 'https://github.com/login/oauth/authorize';
const ACCESS_TOKEN = 'https://github.com/login/oauth/access_token';
const API = 'https://api.github.com';

// ── The ports ──────────────────────────────────────────────────────────────────

/** A dossier as the signed-in person reads it: its home repository and its PRD (null on a draft). */
export type SendTarget = { dossierId: string; homeRepo: string; prd: PrdNumber | null };

export type SendOutcome = { commentUrl: string; login: string; counted: boolean } | { error: string };

/** outbox_sends and what a send reads, as the signed-in person: row-level security decides. */
export type SendStore = {
  /** The dossier, or null when the caller is no member of its workspace (or it never was). */
  target(dossierId: string): Promise<SendTarget | null>;
  /** Records a send; its id. */
  create(send: { dossierId: string; prNumber: PrNumber; reply: string; nonceHash: string }): Promise<string>;
  /** The caller's own send, or null. */
  read(sendId: string): Promise<SendRow | null>;
  /** Records its outcome, once (outbox_send_done()). */
  done(sendId: string, outcome: SendOutcome): Promise<void>;
};

/** PRD 426's reader, as a send uses it: a fresh summary, and the cached one cleared. */
export type OutboxSource = {
  /** The dossier's summary read fresh from GitHub, as the omni-loop App; null when it could not be read. */
  fresh(dossier: DossierRef): Promise<GithubSummary | null>;
  /** Clears the dossier's cached summary. */
  forget(dossierId: string): void;
};

/** Why GitHub posted nothing: the kind decides the words the send records. */
export class GitHubError extends Error {
  readonly kind: 'refused' | 'down' | 'no-access' | 'gone';
  readonly status: number | null;
  constructor(kind: 'refused' | 'down' | 'no-access' | 'gone', status: number | null) {
    super(`GitHub: ${kind}${status === null ? '' : ` (${status})`}`);
    this.kind = kind;
    this.status = status;
  }
}

/** What a send asks of GitHub, as the person. */
export type GitHubUser = {
  /** A user token for the code GitHub sent back. */
  exchange(code: string): Promise<string>;
  /** Posts `body` on the pull request as the token's person. */
  comment(token: string, repo: string, number: PrNumber, body: string): Promise<{ url: string; login: string; association: string }>;
};

export type SendDeps = {
  /** The omni-loop App's client id (GITHUB_APP_CLIENT_ID), or null: Send is off here. */
  clientId: string | null;
  /** The store as the signed-in person, or null when nobody is signed in (or no database). */
  store: () => Promise<SendStore | null>;
  outbox: OutboxSource;
  github: () => GitHubUser;
  nonce?: () => string;
  /** Recounts the dossier's PRD's open outbox questions once a reply is posted (PRD 657, s5); none, no recount. */
  recount?: (dossierId: string) => Promise<void>;
};

// ── GitHub, over fetch ─────────────────────────────────────────────────────────

/** GitHub's answer to the code: a user token, never empty. */
const TokenReply = z.object({ access_token: z.string().min(1) });

/** GitHub's answer to the comment: its address, and who posted it as GitHub says, blank when it does not. */
const CommentReply = z.object({
  html_url: z.string(),
  user: z.object({ login: z.string().catch('') }).catch({ login: '' }),
  author_association: z.string().catch(''),
});

/** GitHub's side of a send: the code traded for a user token, then the comment. Errors carry a kind and
 * a status, never the token. */
export function githubUser({ clientId, clientSecret, fetch }: { clientId: string; clientSecret: string; fetch: typeof globalThis.fetch }): GitHubUser {
  async function call(url: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(url, init);
    } catch {
      throw new GitHubError('down', null);
    }
  }
  return {
    async exchange(code) {
      const response = await call(ACCESS_TOKEN, {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
      });
      if (response.status >= 500) throw new GitHubError('down', response.status);
      const body = TokenReply.safeParse(await response.json().catch(() => null));
      if (!response.ok || !body.success) throw new GitHubError('refused', response.status);
      return body.data.access_token;
    },
    async comment(token, repo, number, text) {
      const response = await call(`${API}/repos/${repo}/issues/${number}/comments`, {
        method: 'POST',
        headers: {
          accept: 'application/vnd.github+json', authorization: `Bearer ${token}`, 'content-type': 'application/json',
          'user-agent': 'omni-loop', 'x-github-api-version': '2022-11-28',
        },
        body: JSON.stringify({ body: text }),
      });
      if (response.status === 404 || response.status === 410) throw new GitHubError('gone', response.status);
      if (response.status === 401 || response.status === 403 || response.status === 422) throw new GitHubError('no-access', response.status);
      if (!response.ok) throw new GitHubError('down', response.status);
      const body = CommentReply.safeParse(await response.json().catch(() => null));
      if (!body.success) throw new GitHubError('down', response.status);
      return { url: body.data.html_url, login: body.data.user.login, association: body.data.author_association };
    },
  };
}

// ── The questions and the reply ────────────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const SendBody = z.object({
  dossier: z.string().regex(UUID, 'a dossier id'),
  picks: z.array(z.object({
    number: z.number().int().positive(),
    pick: z.string().min(1).max(20),
    reason: z.string().max(5000).optional(),
  }).strict()).min(1).max(200),
});
export type SendBody = z.infer<typeof SendBody>;

/** A question a reply may answer, as the kit's reply writer takes it. */
export type Question = { number: number; rank: string; options: Array<{ letter: string; text: string }> };

export type Questions =
  | { ok: true; prd: PrdNumber; prNumber: PrNumber; questions: Question[] }
  | { ok: false; status: number; error: string };

const UNREACHABLE = 'GitHub did not answer, so nothing was sent. Try again in a moment.';

/** The questions a send may answer, from a fresh summary: every item the outbox comment numbers that is
 * still open, or adopted (answered by objecting). Refuses when GitHub could not be read, when there is no
 * feature pull request or outbox yet, and once the feature pull request merged. Pure. */
export function questionsOf(summary: GithubSummary | null): Questions {
  if (summary === null) return { ok: false, status: 503, error: UNREACHABLE };
  const { feature, outbox = null, replies = null } = summary;
  if (feature === UNREAD || outbox === UNREAD || replies === UNREAD) return { ok: false, status: 503, error: UNREACHABLE };
  if (feature === null) return { ok: false, status: 404, error: 'This PRD has no feature pull request to answer on yet.' };
  if (feature.state === 'merged') return { ok: false, status: 409, error: 'The feature pull request merged: nothing can be answered any more.' };
  if (outbox === null || replies === null) return { ok: false, status: 404, error: 'This PRD has no outbox you can answer yet.' };
  const open = new Map(outbox.open.map((item) => [item.id, item]));
  const adopted = new Map((outbox.adopted ?? []).map((item) => [item.id, item]));
  const questions = replies.numbering.flatMap(({ number, id }): Question[] => {
    const item = open.get(id) ?? adopted.get(id);
    if (!item) return [];
    return [{ number, rank: open.has(id) ? item.rank : 'medium', options: item.options.map(({ letter, text }) => ({ letter, text })) }];
  }).sort((a, b) => a.number - b.number);
  return { ok: true, prd: summary.prd, prNumber: feature.number, questions };
}

export type BuiltReply = { ok: true; reply: string; dropped: number[] } | { ok: false; reason: string; dropped: number[] };

/** The reply the picks write: every question still open or adopted may be answered; a pick on any other
 * was settled meanwhile and is dropped. Pure. */
export function buildReply(questions: Question[], prd: PrdNumber, picks: SendBody['picks']): BuiltReply {
  const known = new Set(questions.map((q) => q.number));
  const dropped = picks.filter((p) => !known.has(p.number)).map((p) => p.number).sort((a, b) => a - b);
  const kept = picks.filter((p) => known.has(p.number)).map(({ number, pick, reason }) => (reason?.trim() ? { number, pick, reason } : { number, pick }));
  if (kept.length === 0) {
    return { ok: false, reason: 'Every question you answered was settled meanwhile: nothing is left to send.', dropped };
  }
  const written = writeReply({ prd, door: 'page', questions, picks: kept });
  return written.ok ? { ok: true, reply: written.reply, dropped } : { ok: false, reason: written.reason, dropped };
}

// ── POST /api/outbox/send ──────────────────────────────────────────────────────

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store', ...headers } });
const refuse = (status: number, error: string, more: Record<string, unknown> = {}) => json(status, { error, ...more });

const hashOf = (nonce: string) => createHash('sha256').update(nonce).digest('hex');

function nonceCookie(value: string, maxAge: number) {
  return `${NONCE_COOKIE}=${value}; Path=${sendCallbackPath}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

export async function startSend(request: Request, deps: SendDeps): Promise<Response> {
  if (!deps.clientId) return refuse(503, 'Sending from this page is not open here: reply on the pull request.');
  const store = await deps.store();
  if (!store) return refuse(401, 'Sign in first.');

  let sent: unknown;
  try {
    sent = await request.json();
  } catch {
    return refuse(400, 'The body must be a JSON object.');
  }
  const parsed = SendBody.safeParse(sent);
  if (!parsed.success) {
    const issue = defined(parsed.error.issues[0], 'the failed parse\'s first issue');
    return refuse(400, `The answers are malformed: ${issue.path.join('.') || 'the body'}: ${issue.message}.`);
  }
  const { dossier, picks } = parsed.data;

  const target = await store.target(dossier);
  if (!target || target.prd === null) return refuse(404, 'This PRD has no outbox you can answer.');
  const read = questionsOf(await deps.outbox.fresh({ id: target.dossierId, home_repo: target.homeRepo, prd: target.prd }));
  if (!read.ok) return refuse(read.status, read.error);

  const built = buildReply(read.questions, read.prd, picks);
  if (!built.ok) return refuse(built.dropped.length === picks.length ? 409 : 400, built.reason, { dropped: built.dropped });

  const nonce = (deps.nonce ?? (() => randomBytes(32).toString('base64url')))();
  const id = await store.create({ dossierId: dossier, prNumber: read.prNumber, reply: built.reply, nonceHash: hashOf(nonce) });
  const authorize = new URL(AUTHORIZE);
  authorize.searchParams.set('client_id', deps.clientId);
  authorize.searchParams.set('redirect_uri', `${requestOrigin(request)}${sendCallbackPath}`);
  authorize.searchParams.set('state', `${id}.${nonce}`);
  return json(200, { send: id, authorize: authorize.toString(), dropped: built.dropped }, { 'set-cookie': nonceCookie(nonce, NONCE_MAX_AGE) });
}

// ── /prd/github/callback ───────────────────────────────────────────────────────

const STATE = /^([0-9a-f-]{36})\.([A-Za-z0-9_-]{16,128})$/i;
const REPO = /^[\w.-]+\/[\w.-]+$/;

function readCookie(request: Request, name: string): string | null {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return value.join('=') || null;
  }
  return null;
}

function sameNonce(given: string, cookie: string | null, hash: string): boolean {
  if (!cookie) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(cookie);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  const h = Buffer.from(hashOf(given));
  const stored = Buffer.from(hash);
  return h.length === stored.length && timingSafeEqual(h, stored);
}

/** The words a send records when GitHub posted nothing. */
export function failureWords(error: GitHubError, repo: string | null, number: PrNumber): string {
  const pr = repo ? `pull request #${number} of ${repo}` : `pull request #${number}`;
  switch (error.kind) {
    case 'refused': return "GitHub's authorisation was refused, so nothing was posted.";
    case 'down': return 'GitHub did not answer, so nothing was posted. Try again in a moment.';
    case 'no-access': return `Your GitHub account may not comment on ${pr}, so nothing was posted.`;
    case 'gone': return `${pr.charAt(0).toUpperCase()}${pr.slice(1)} is gone, or your GitHub account cannot see it, so nothing was posted.`;
  }
}

export async function finishSend(request: Request, deps: SendDeps): Promise<Response> {
  const origin = requestOrigin(request);
  const url = new URL(request.url);
  const back = (location: string) => new Response(null, {
    status: 303,
    headers: { location: `${origin}${location}`, 'cache-control': 'no-store', 'set-cookie': nonceCookie('', 0) },
  });
  const tab = (dossierId: string, send: string) => back(`/prd/${dossierId}?tab=outbox&send=${send}`);
  const refused = (code: SendErrorCode, dossierId: string | null) =>
    back(dossierId ? `/prd/${dossierId}?tab=outbox&send_error=${code}` : `/prd?send_error=${code}`);

  const state = STATE.exec(url.searchParams.get('state') ?? '');
  const store = await deps.store();
  if (!store) return refused('signin', null);
  if (!state) return refused('state', null);
  const sendId = group(state, 1);
  const nonce = group(state, 2);

  // Someone else's send reads as none: nothing is posted, nothing recorded.
  const send = await store.read(sendId);
  if (!send) return refused('state', null);
  // Its outcome is already recorded: a replay posts nothing a second time.
  if (send.posted_at !== null || send.error !== null) return tab(send.dossier_id, send.id);
  if (!sameNonce(nonce, readCookie(request, NONCE_COOKIE), send.nonce_hash)) return refused('state', send.dossier_id);

  const target = await store.target(send.dossier_id);
  const repo = target && REPO.test(target.homeRepo) ? target.homeRepo : null;
  let outcome: SendOutcome;
  try {
    const code = url.searchParams.get('code');
    if (url.searchParams.get('error') || !code) throw new GitHubError('refused', null);
    if (!repo) throw new GitHubError('gone', null);
    const github = deps.github();
    let token: string | null = await github.exchange(code);
    try {
      const posted = await github.comment(token, repo, send.pr_number, send.reply);
      outcome = { commentUrl: posted.url, login: posted.login, counted: WRITER_ASSOCIATIONS.has(posted.association) };
    } finally {
      token = null;
    }
  } catch (error) {
    if (!(error instanceof GitHubError)) throw error;
    console.error(`outbox send ${send.id}: ${error.message}`);
    outcome = { error: failureWords(error, repo, send.pr_number) };
  }
  if (!('error' in outcome)) {
    deps.outbox.forget(send.dossier_id);
    try {
      await deps.recount?.(send.dossier_id);
    } catch (error) {
      console.error(`outbox send ${send.id}: the PRD's open questions could not be recounted: ${messageOf(error)}`);
    }
  }
  try {
    await store.done(send.id, outcome);
  } catch (error) {
    console.error(`outbox send ${send.id}: the outcome could not be recorded: ${messageOf(error)}`);
  }
  return tab(send.dossier_id, send.id);
}

// ── GET /api/outbox/send?id= ───────────────────────────────────────────────────

/** A send's outcome, as its owner's tab shows it; never its nonce's hash. */
export async function readSend(request: Request, deps: Pick<SendDeps, 'store'>): Promise<Response> {
  const id = new URL(request.url).searchParams.get('id') ?? '';
  if (!UUID.test(id)) return refuse(400, 'A send is named by its id.');
  const store = await deps.store();
  if (!store) return refuse(401, 'Sign in first.');
  const row = await store.read(id);
  if (!row) return refuse(404, 'No such send.');
  const target = await store.target(row.dossier_id);
  return json(200, sentView(row, target?.prd ?? null, null));
}
