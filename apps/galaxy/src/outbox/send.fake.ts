// Fakes for Send's tests (PRD 251, "Send posts the reply as you"): the sends of one signed-in person in
// memory, kept by the rules supabase/migrations/20260929090000_outbox_answers.sql gives outbox_sends —
// only the owner reads a send, and outbox_send_done() records an outcome once — and a GitHub that
// answers the two calls a send makes, OAuth's code exchange and the comment, over a fake fetch. That the
// database itself holds those rules is proved by supabase/checks/outbox_answers.sql, not here.
import type { OutboxRow } from './store';
import type { SendRow, SendStore, SendTarget } from './send';

export type FakeSends = ReturnType<typeof fakeSendStore>;

/** The store as `viewer` sees it: the dossiers they are a member of, and every send (theirs or not). */
export function fakeSendStore(viewer: string, dossiers: Array<{ id: string; prd: number | null; members: string[]; outbox: OutboxRow | null }>) {
  const sends: Array<SendRow & { owner: string }> = [];
  let next = 1;
  const store: SendStore = {
    async target(dossierId): Promise<SendTarget | null> {
      const d = dossiers.find((x) => x.id === dossierId && x.members.includes(viewer));
      return d ? { dossierId: d.id, prd: d.prd, outbox: d.outbox } : null;
    },
    async create({ dossierId, prNumber, reply, nonceHash }) {
      if (!dossiers.some((x) => x.id === dossierId && x.members.includes(viewer))) throw new Error('row-level security refused the send');
      const id = `00000000-0000-4000-8000-${String(next++).padStart(12, '0')}`;
      sends.push({
        id, owner: viewer, dossier_id: dossierId, pr_number: prNumber, reply, nonce_hash: nonceHash,
        created_at: '2026-09-27T10:05:00.000Z', posted_at: null, comment_url: null, login: null, counted: null, error: null,
      });
      return id;
    },
    async read(sendId) {
      const send = sends.find((s) => s.id === sendId && s.owner === viewer);
      if (!send) return null;
      const { owner: _owner, ...row } = send;
      return { ...row };
    },
    async done(sendId, outcome) {
      const send = sends.find((s) => s.id === sendId && s.owner === viewer);
      if (!send) throw new Error('No such send.');
      if (send.posted_at !== null || send.error !== null) throw new Error("This send's outcome is already recorded.");
      if ('error' in outcome) send.error = outcome.error.slice(0, 1000);
      else Object.assign(send, { posted_at: '2026-09-27T10:06:00.000Z', comment_url: outcome.commentUrl, login: outcome.login, counted: outcome.counted });
    },
  };
  /** Another person's send, which `viewer` cannot read. */
  function othersSend(row: Omit<SendRow, 'id'> & { owner: string }) {
    const id = `00000000-0000-4000-8000-${String(next++).padStart(12, '0')}`;
    sends.push({ ...row, id });
    return id;
  }
  return { store, sends, othersSend };
}

export type GitHubCall = { url: string; method: string; headers: Record<string, string>; body: string };

type Answer = { status: number; body?: unknown } | 'down';

/** A GitHub answering over fetch: the code exchange, then the comment. Each answer can be changed. */
export function fakeGitHub({
  token = 'ghu_user_token_never_kept',
  exchange = { status: 200, body: { access_token: 'ghu_user_token_never_kept', token_type: 'bearer' } } as Answer,
  comment = {
    status: 201,
    body: { html_url: 'https://github.com/acme/widgets/pull/12#issuecomment-99', user: { login: 'ada' }, author_association: 'MEMBER' },
  } as Answer,
} = {}) {
  const calls: GitHubCall[] = [];
  const answers = { exchange, comment };
  const fetch = async (input: string | URL | Request, init: RequestInit = {}): Promise<Response> => {
    const url = String(input);
    calls.push({ url, method: init.method ?? 'GET', headers: Object.fromEntries(new Headers(init.headers).entries()), body: String(init.body ?? '') });
    const answer = url.startsWith('https://github.com/login/oauth/access_token') ? answers.exchange : answers.comment;
    if (answer === 'down') throw new TypeError('fetch failed');
    return Response.json(answer.body ?? {}, { status: answer.status });
  };
  return { fetch: fetch as typeof globalThis.fetch, calls, answers, token };
}
