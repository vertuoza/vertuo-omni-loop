// Ported from archive/outbox-answers-v1:apps/galaxy/src/outbox/send.fake.ts (PRD 251, s11); the outbox
// now comes from a fake of PRD 426's GitHub reader, not from a stored copy.
//
// Fakes for Send's tests (PRD 251, "Send posts the reply as you"): the sends of one signed-in person in
// memory, kept by the rules supabase/migrations/20261005090000_outbox_sends.sql gives outbox_sends —
// only the owner reads a send, only a member of the dossier's workspace makes one, and
// outbox_send_done() records an outcome once — a reader whose summary each test sets, and a GitHub that
// answers the two calls a send makes, OAuth's code exchange and the comment, over a fake fetch. That the
// database itself holds those rules is proved by supabase/checks/outbox_sends.sql, not here.
import type { GithubSummary } from '../dossier/github/summary';
import type { OutboxSource, SendStore, SendTarget } from './send';
import type { SendRow } from './sent';

export type FakeDossier = { id: string; homeRepo: string; prd: number | null; members: string[] };

/** The store as `viewer` sees it: the dossiers they are a member of, and every send (theirs or not). */
export function fakeSendStore(viewer: string, dossiers: FakeDossier[]) {
  const sends: Array<SendRow & { owner: string }> = [];
  let next = 1;
  const store: SendStore = {
    target(dossierId): Promise<SendTarget | null> {
      const d = dossiers.find((x) => x.id === dossierId && x.members.includes(viewer));
      return Promise.resolve(d ? { dossierId: d.id, homeRepo: d.homeRepo, prd: d.prd } : null);
    },
    create({ dossierId, prNumber, reply, nonceHash }) {
      if (!dossiers.some((x) => x.id === dossierId && x.members.includes(viewer))) return Promise.reject(new Error('row-level security refused the send'));
      const id = `00000000-0000-4000-8000-${String(next++).padStart(12, '0')}`;
      sends.push({
        id, owner: viewer, dossier_id: dossierId, pr_number: prNumber, reply, nonce_hash: nonceHash,
        created_at: '2026-09-28T10:05:00.000Z', posted_at: null, comment_url: null, login: null, counted: null, error: null,
      });
      return Promise.resolve(id);
    },
    read(sendId) {
      const send = sends.find((s) => s.id === sendId && s.owner === viewer);
      return Promise.resolve(send ? ownerless(send) : null);
    },
    done(sendId, outcome) {
      const send = sends.find((s) => s.id === sendId && s.owner === viewer);
      if (!send) return Promise.reject(new Error('No such send.'));
      if (send.posted_at !== null || send.error !== null) return Promise.reject(new Error("This send's outcome is already recorded."));
      if ('error' in outcome) send.error = outcome.error.slice(0, 1000);
      else Object.assign(send, { posted_at: '2026-09-28T10:06:00.000Z', comment_url: outcome.commentUrl, login: outcome.login, counted: outcome.counted });
      return Promise.resolve();
    },
  };
  return { store, sends };
}

/** A send as its owner reads it: every column but the owner the fake keeps beside it. */
function ownerless(send: SendRow & { owner: string }): SendRow {
  return {
    id: send.id, dossier_id: send.dossier_id, pr_number: send.pr_number, reply: send.reply, nonce_hash: send.nonce_hash,
    created_at: send.created_at, posted_at: send.posted_at, comment_url: send.comment_url, login: send.login, counted: send.counted, error: send.error,
  };
}

/** PRD 426's reader, as a send uses it: every read counted, every forget recorded. */
export function fakeOutboxSource(summary: GithubSummary | null) {
  const reads: string[] = [];
  const forgotten: string[] = [];
  const state = { summary };
  const source: OutboxSource = {
    fresh(ref) {
      reads.push(ref.id);
      return Promise.resolve(state.summary);
    },
    forget(id) {
      forgotten.push(id);
    },
  };
  return { source, reads, forgotten, state };
}

export type GitHubCall = { url: string; method: string; headers: Record<string, string>; body: string };

type Answer = { status: number; body?: unknown } | 'down';

/** A GitHub answering over fetch: the code exchange, then the comment. Each answer can be changed. */
export function fakeGitHub({
  exchange = { status: 200, body: { access_token: 'ghu_user_token_never_kept', token_type: 'bearer' } },
  comment = {
    status: 201,
    body: { html_url: 'https://github.com/acme/widgets/pull/12#issuecomment-99', user: { login: 'ada' }, author_association: 'MEMBER' },
  },
}: { exchange?: Answer; comment?: Answer } = {}) {
  const token = 'ghu_user_token_never_kept';
  const calls: GitHubCall[] = [];
  const answers = { exchange, comment };
  const fetch = (input: string | URL | Request, init: RequestInit = {}): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    // A send posts JSON text: any other body would be a change this fake should show, not hide.
    const body = init.body === undefined || init.body === null ? '' : typeof init.body === 'string' ? init.body : `<${init.body.constructor.name}>`;
    calls.push({ url, method: init.method ?? 'GET', headers: Object.fromEntries(new Headers(init.headers).entries()), body });
    const answer = url.startsWith('https://github.com/login/oauth/access_token') ? answers.exchange : answers.comment;
    if (answer === 'down') return Promise.reject(new TypeError('fetch failed'));
    return Promise.resolve(Response.json(answer.body ?? {}, { status: answer.status }));
  };
  return { fetch, calls, answers, token };
}
