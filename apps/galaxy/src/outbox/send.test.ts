import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { outboxRow, STORED } from './fixtures';
import { fakeGitHub, fakeSendStore } from './send.fake';
import {
  finishSend, githubUser, NONCE_COOKIE, sendCallbackPath, startSend, type SendDeps,
} from './send';
import { sentView } from './sent';

// Send (PRD 251, "Send posts the reply as you"): the picks checked against the stored outbox and
// written by the kit's reply writer, recorded as a send, then GitHub's authorisation of the omni-loop
// App and the callback that posts the reply once, as the person, and drops the token. A fake GitHub
// over fetch, a fake store: no test calls GitHub or Supabase.

const DOSSIER = '00000000-0000-4000-8000-0000000000d1';
const ELSEWHERE = '00000000-0000-4000-8000-0000000000e2';
const ORIGIN = 'https://omni.example';
const NONCE = 'n0nce-n0nce-n0nce-n0nce-n0nce-n0nce-0000';
const hash = (nonce: string) => createHash('sha256').update(nonce).digest('hex');

function world({ viewer = 'u-ada', outbox = outboxRow() as ReturnType<typeof outboxRow> | null, gh = fakeGitHub(), clientId = 'Iv1.client' as string | null } = {}) {
  const sends = fakeSendStore(viewer, [
    { id: DOSSIER, prd: 7, members: ['u-ada', 'u-bob'], outbox },
    { id: ELSEWHERE, prd: 9, members: ['u-eve'], outbox: outboxRow({ dossier_id: ELSEWHERE }) },
  ]);
  const deps: SendDeps = {
    clientId,
    store: async () => sends.store,
    github: () => githubUser({ clientId: 'Iv1.client', clientSecret: 'shh-client-secret', fetch: gh.fetch }),
    nonce: () => NONCE,
  };
  const start = async (body: unknown) => {
    const response = await startSend(new Request(`${ORIGIN}/api/outbox/send`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    }), deps);
    return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie') };
  };
  const back = async (query: Record<string, string>, cookie: string | null = NONCE) => {
    const url = new URL(`${ORIGIN}${sendCallbackPath}`);
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    const response = await finishSend(new Request(url, { headers: cookie === null ? {} : { cookie: `${NONCE_COOKIE}=${cookie}` } }), deps);
    return { status: response.status, location: response.headers.get('location'), cookie: response.headers.get('set-cookie') };
  };
  return { sends, gh, deps, start, back };
}

const PICKS = [
  { number: 2, pick: 'B', reason: 'orange is\nsofter <!-- sneaky -->' },
  { number: 1, pick: 'done' },
];

afterEach(() => vi.restoreAllMocks());

describe('POST /api/outbox/send: the reply, written once and recorded as a send', () => {
  it('builds the reply from the checked picks with the reply writer, records it, and answers GitHub\'s authorisation', async () => {
    const w = world();
    const { status, body, cookie } = await w.start({ dossier: DOSSIER, picks: PICKS });

    expect(status).toBe(200);
    const [send] = w.sends.sends;
    expect(send.reply).toBe('1: ok\n2: B because orange is softer sneaky\n\n_answered on the Omni page · PRD 7_');
    expect(send).toMatchObject({ owner: 'u-ada', dossier_id: DOSSIER, pr_number: 12, nonce_hash: hash(NONCE), posted_at: null });
    expect(body.dropped).toEqual([]);
    const authorize = new URL(body.authorize);
    expect(authorize.origin + authorize.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(authorize.searchParams.get('client_id')).toBe('Iv1.client');
    expect(authorize.searchParams.get('redirect_uri')).toBe(`${ORIGIN}/prd/github/callback`);
    expect(authorize.searchParams.get('state')).toBe(`${send.id}.${NONCE}`);
    // The nonce rides in a short-lived, http-only cookie, only as far as the callback.
    expect(cookie).toContain(`${NONCE_COOKIE}=${NONCE}`);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/prd\/github/);
    expect(cookie).toMatch(/Max-Age=600/);
    expect(w.gh.calls).toEqual([]);
  });

  it('objects to an adopted medium with another of its letters', async () => {
    const w = world();
    const { status } = await w.start({ dossier: DOSSIER, picks: [{ number: 3, pick: 'B', reason: 'too big' }] });
    expect(status).toBe(200);
    expect(w.sends.sends[0].reply).toBe('3: B because too big\n\n_answered on the Omni page · PRD 7_');
  });

  it('drops a pick whose question was settled meanwhile, and says so', async () => {
    const w = world();
    const { status, body } = await w.start({ dossier: DOSSIER, picks: [...PICKS, { number: 4, pick: 'A' }] });
    expect(status).toBe(200);
    expect(body.dropped).toEqual([4]);
    expect(w.sends.sends[0].reply).not.toContain('4:');
  });

  it('records nothing when every pick was settled meanwhile', async () => {
    const w = world();
    const { status, body } = await w.start({ dossier: DOSSIER, picks: [{ number: 4, pick: 'A' }] });
    expect(status).toBe(409);
    expect(body).toMatchObject({ dropped: [4], error: expect.stringMatching(/settled meanwhile/) });
    expect(w.sends.sends).toEqual([]);
  });

  it('refuses what the reply writer refuses, and records nothing', async () => {
    const w = world();
    for (const picks of [[{ number: 2, pick: 'D' }], [{ number: 1, pick: 'A' }], [{ number: 1, pick: 'not-done' }], [{ number: 2, pick: 'done' }]]) {
      const { status, body } = await w.start({ dossier: DOSSIER, picks });
      expect(status).toBe(400);
      expect(body.error).toMatch(/question \d/);
    }
    expect(w.sends.sends).toEqual([]);
  });

  it('refuses a malformed body', async () => {
    const w = world();
    expect((await w.start({ dossier: 'nope', picks: PICKS })).status).toBe(400);
    expect((await w.start({ dossier: DOSSIER, picks: [] })).status).toBe(400);
    expect((await w.start({ dossier: DOSSIER })).status).toBe(400);
  });

  it('answers not found on a dossier of another workspace, and when nothing is stored', async () => {
    expect((await world().start({ dossier: ELSEWHERE, picks: PICKS })).status).toBe(404);
    expect((await world({ outbox: null }).start({ dossier: DOSSIER, picks: PICKS })).status).toBe(404);
  });

  it('refuses once the feature pull request merged or closed', async () => {
    const w = world({ outbox: outboxRow({ state: 'merged' }) });
    const { status, body } = await w.start({ dossier: DOSSIER, picks: PICKS });
    expect(status).toBe(409);
    expect(body.error).toMatch(/merged/);
  });

  it('asks to sign in first, and is off without the App\'s client id', async () => {
    const signedOut = world();
    signedOut.deps.store = async () => null;
    expect((await signedOut.start({ dossier: DOSSIER, picks: PICKS })).status).toBe(401);
    expect((await world({ clientId: null }).start({ dossier: DOSSIER, picks: PICKS })).status).toBe(503);
  });
});

describe('/prd/github/callback: the reply posted once, as the person', () => {
  async function started(w = world()) {
    const { body } = await w.start({ dossier: DOSSIER, picks: PICKS });
    return { w, state: new URL(body.authorize).searchParams.get('state')!, id: w.sends.sends[0].id };
  }

  it('trades the code, posts the reply on the feature pull request, records its link and author, and drops the token', async () => {
    const log = vi.spyOn(console, 'error');
    const info = vi.spyOn(console, 'log');
    const { w, state, id } = await started();
    const { status, location, cookie } = await w.back({ code: 'the-code', state });

    expect(status).toBe(303);
    expect(location).toBe(`${ORIGIN}/prd/${DOSSIER}?tab=outbox&send=${id}`);
    const [exchange, comment] = w.gh.calls;
    expect(exchange.url).toBe('https://github.com/login/oauth/access_token');
    expect(JSON.parse(exchange.body)).toEqual({ client_id: 'Iv1.client', client_secret: 'shh-client-secret', code: 'the-code' });
    expect(comment.url).toBe('https://api.github.com/repos/acme/widgets/issues/12/comments');
    expect(comment.method).toBe('POST');
    expect(comment.headers.authorization).toBe(`Bearer ${w.gh.token}`);
    expect(JSON.parse(comment.body)).toEqual({ body: w.sends.sends[0].reply });
    expect(w.sends.sends[0]).toMatchObject({
      posted_at: expect.any(String), comment_url: 'https://github.com/acme/widgets/pull/12#issuecomment-99', login: 'ada', counted: true, error: null,
    });
    // The token is never written to a cookie, a row or a log.
    expect(cookie).toMatch(new RegExp(`${NONCE_COOKIE}=;`));
    expect(cookie).not.toContain(w.gh.token);
    expect(JSON.stringify(w.sends.sends)).not.toContain(w.gh.token);
    expect(JSON.stringify([...log.mock.calls, ...info.mock.calls])).not.toContain(w.gh.token);
  });

  it('a replayed callback posts nothing a second time', async () => {
    const { w, state } = await started();
    await w.back({ code: 'the-code', state });
    const { location } = await w.back({ code: 'the-code', state });
    expect(w.gh.calls.filter((c) => c.url.includes('/comments'))).toHaveLength(1);
    expect(location).toContain('send=');
  });

  it('a wrong nonce posts nothing and records nothing', async () => {
    const { w, state, id } = await started();
    for (const [query, cookie] of [
      [{ code: 'c', state }, 'another-nonce-another-nonce-another'],
      [{ code: 'c', state }, null],
      [{ code: 'c', state: `${id}.another-nonce-another-nonce-another` }, 'another-nonce-another-nonce-another'],
      [{ code: 'c', state: 'nothing-like-a-state' }, NONCE],
    ] as const) {
      const { location } = await w.back(query, cookie);
      expect(location).toMatch(/send_error=state/);
    }
    expect(w.gh.calls).toEqual([]);
    expect(w.sends.sends[0]).toMatchObject({ posted_at: null, error: null });
  });

  it('another person\'s send posts nothing', async () => {
    const { w, state } = await started();
    const eve = world({ viewer: 'u-bob', gh: w.gh });
    // Bob, a member of the same workspace, comes back with Ada's state and even her nonce.
    (eve.sends.sends as unknown[]).push(...w.sends.sends);
    const { location } = await eve.back({ code: 'c', state });
    expect(location).toMatch(/send_error=state/);
    expect(w.gh.calls).toEqual([]);
  });

  it('an author GitHub lists as one the kit does not count is recorded as uncounted', async () => {
    const gh = fakeGitHub({ comment: { status: 201, body: { html_url: 'https://github.com/acme/widgets/pull/12#issuecomment-7', user: { login: 'visitor' }, author_association: 'CONTRIBUTOR' } } });
    const { w, state } = await started(world({ gh }));
    await w.back({ code: 'c', state });
    expect(w.sends.sends[0]).toMatchObject({ login: 'visitor', counted: false });
  });

  const FAILURES = [
    ['the authorisation refused', { exchange: { status: 200, body: { error: 'bad_verification_code' } } }, {}, /authorisation was refused/],
    ['GitHub down', { exchange: 'down' as const }, {}, /GitHub did not answer/],
    ['GitHub failing', { comment: { status: 502 } }, {}, /GitHub did not answer/],
    ['no access', { comment: { status: 403, body: { message: 'Resource not accessible by integration' } } }, {}, /may not comment/],
    ['the pull request gone', { comment: { status: 404, body: { message: 'Not Found' } } }, {}, /is gone/],
  ] as const;

  for (const [what, answers, , error] of FAILURES) {
    it(`${what}: posts nothing and records the error`, async () => {
      const { w, state, id } = await started(world({ gh: fakeGitHub(answers as Parameters<typeof fakeGitHub>[0]) }));
      const { location } = await w.back({ code: 'c', state });
      expect(location).toBe(`${ORIGIN}/prd/${DOSSIER}?tab=outbox&send=${id}`);
      expect(w.sends.sends[0]).toMatchObject({ posted_at: null, comment_url: null, error: expect.stringMatching(error) });
      expect(w.sends.sends[0].error).not.toContain('ghu_');
    });
  }

  it('the person refusing on GitHub posts nothing and records it', async () => {
    const { w, state } = await started();
    await w.back({ error: 'access_denied', error_description: 'The user has denied your application access.', state });
    expect(w.gh.calls).toEqual([]);
    expect(w.sends.sends[0].error).toMatch(/authorisation was refused/);
  });
});

describe('the result on the tab', () => {
  const row = {
    id: 's1', dossier_id: DOSSIER, pr_number: 12, reply: '2: B\n\n_answered on the Omni page · PRD 7_', nonce_hash: 'h',
    created_at: '2026-09-27T10:05:00Z', posted_at: null as string | null, comment_url: null as string | null,
    login: null as string | null, counted: null as boolean | null, error: null as string | null,
  };

  it('posted: sent as @login, its link, and the next step', () => {
    expect(sentView({ ...row, posted_at: '2026-09-27T10:06:00Z', comment_url: 'https://x/1', login: 'ada', counted: true }, 7, null)).toEqual({
      state: 'posted', login: 'ada', url: 'https://x/1', counted: true, next: '/omni:yolo-fix 7', reply: row.reply, at: '2026-09-27T10:06:00Z',
    });
  });

  it('failed: the error; waiting: nothing recorded yet; a wrong state says why', () => {
    expect(sentView({ ...row, error: 'GitHub did not answer.' }, 7, null)).toEqual({ state: 'failed', error: 'GitHub did not answer.' });
    expect(sentView(row, 7, null)).toEqual({ state: 'waiting' });
    expect(sentView(null, 7, 'state')).toMatchObject({ state: 'failed', error: expect.stringMatching(/did not match/) });
    expect(sentView(null, 7, null)).toBeNull();
  });
});
