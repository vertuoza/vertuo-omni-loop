import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UNREAD, type GithubSummary, type OutboxItem } from '../dossier/github/summary';
import { fakeGitHub, fakeOutboxSource, fakeSendStore } from './send.fake';
import {
  finishSend, githubUser, NONCE_COOKIE, questionsOf, readSend, sendCallbackPath, startSend, type SendDeps,
} from './send';
import { sure } from '../arcade/sure';
import { sentView, UNCOUNTED } from './sent';

// Send (PRD 251, "Send posts the reply as you"; s11, ported from the first build's s5): the picks checked
// against a fresh read of the outbox through PRD 426's GitHub reader, written by the kit's reply writer,
// recorded as a send, then GitHub's authorisation of the omni-loop App and the callback that posts the
// reply once, as the person, drops the token and clears the dossier's cached summary. A fake reader, a
// fake GitHub over fetch, a fake store: no test calls GitHub or Supabase.

const DOSSIER = '00000000-0000-4000-8000-0000000000d1';
const ELSEWHERE = '00000000-0000-4000-8000-0000000000e2';
const ORIGIN = 'https://omni.example';
const NONCE = 'n0nce-n0nce-n0nce-n0nce-n0nce-n0nce-0000';
const hash = (nonce: string) => createHash('sha256').update(nonce).digest('hex');
const matching = (pattern: RegExp): unknown => expect.stringMatching(pattern);
const A_STRING: unknown = expect.any(String);

/** What POST /api/outbox/send answers: the authorisation to follow, the picks dropped, or why it refused. */
type Started = { authorize?: string; dropped?: number[]; error?: string };

const decision = (id: string, rank: OutboxItem['rank'], letters = ['A', 'B', 'C']): OutboxItem => ({
  id, rank, question: `${id}?`, decision: `${id}: A`, options: letters.map((letter) => ({ letter, text: `${letter} text` })), personSteps: null,
});
const ACTION: OutboxItem = { id: 's11-01-secret', rank: 'human-action', question: 'Set the secret', decision: null, options: [], personSteps: 'Add it.' };

/** PRD 7's summary: question 1 needs a person, 2 is high, 3 an adopted medium, 4 settled already. */
function summary(over: Partial<GithubSummary> = {}): GithubSummary {
  return {
    repo: 'acme/widgets', prd: 7, folder: '0007-widgets', topic: 'widgets',
    issue: { number: 7, url: 'https://github.com/acme/widgets/issues/7', state: 'open' },
    phase0: null,
    feature: { number: 12, url: 'https://github.com/acme/widgets/pull/12', state: 'open', draft: true, mergedAt: null },
    retro: null,
    mergedSlices: 2,
    outbox: {
      open: [ACTION, decision('s11-02-colour', 'high')],
      settled: [{ id: 's11-04-done', title: 'Done?', verdict: 'agreed', answer: '4: A' }],
      adopted: [decision('s11-03-size', 'medium', ['A', 'B'])],
    },
    outboxComment: 'https://github.com/acme/widgets/pull/12#issuecomment-1',
    replies: {
      numbering: [
        { number: 1, id: 's11-01-secret' }, { number: 2, id: 's11-02-colour' }, { number: 3, id: 's11-03-size' }, { number: 4, id: 's11-04-done' },
      ],
      pending: [],
    },
    ...over,
  };
}

function world({ viewer = 'u-ada', read = summary(), gh = fakeGitHub(), clientId = 'Iv1.client' }: {
  viewer?: string; read?: GithubSummary | null; gh?: ReturnType<typeof fakeGitHub>; clientId?: string | null;
} = {}) {
  const sends = fakeSendStore(viewer, [
    { id: DOSSIER, homeRepo: 'acme/widgets', prd: 7, members: ['u-ada', 'u-bob'] },
    { id: ELSEWHERE, homeRepo: 'other/place', prd: 9, members: ['u-eve'] },
  ]);
  const outbox = fakeOutboxSource(read);
  const deps: SendDeps = {
    clientId,
    store: () => Promise.resolve(sends.store),
    outbox: outbox.source,
    github: () => githubUser({ clientId: 'Iv1.client', clientSecret: 'shh-client-secret', fetch: gh.fetch }),
    nonce: () => NONCE,
  };
  const start = async (body: unknown) => {
    const response = await startSend(new Request(`${ORIGIN}/api/outbox/send`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    }), deps);
    return { status: response.status, body: (await response.json()) as Started, cookie: response.headers.get('set-cookie') };
  };
  const back = async (query: Record<string, string>, cookie: string | null = NONCE) => {
    const url = new URL(`${ORIGIN}${sendCallbackPath}`);
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    const response = await finishSend(new Request(url, { headers: cookie === null ? {} : { cookie: `${NONCE_COOKIE}=${cookie}` } }), deps);
    return { status: response.status, location: response.headers.get('location'), cookie: response.headers.get('set-cookie') };
  };
  return { sends, outbox, gh, deps, start, back };
}

const PICKS = [
  { number: 2, pick: 'B', reason: 'orange is\nsofter <!-- sneaky -->' },
  { number: 1, pick: 'done' },
];

afterEach(() => vi.restoreAllMocks());

describe('the questions a send may answer', () => {
  it('reads them off the fresh summary: every numbered open or adopted item, with its rank and letters', () => {
    const read = questionsOf(summary());
    expect(read).toEqual({
      ok: true, prd: 7, prNumber: 12,
      questions: [
        { number: 1, rank: 'human-action', options: [] },
        { number: 2, rank: 'high', options: [{ letter: 'A', text: 'A text' }, { letter: 'B', text: 'B text' }, { letter: 'C', text: 'C text' }] },
        { number: 3, rank: 'medium', options: [{ letter: 'A', text: 'A text' }, { letter: 'B', text: 'B text' }] },
      ],
    });
  });

  it('refuses what cannot be answered: GitHub unread, no feature pull request, merged, no outbox, no numbering', () => {
    expect(questionsOf(null)).toMatchObject({ ok: false, status: 503 });
    expect(questionsOf(summary({ feature: UNREAD }))).toMatchObject({ ok: false, status: 503 });
    expect(questionsOf(summary({ outbox: UNREAD }))).toMatchObject({ ok: false, status: 503 });
    expect(questionsOf(summary({ replies: UNREAD }))).toMatchObject({ ok: false, status: 503 });
    expect(questionsOf(summary({ feature: null }))).toMatchObject({ ok: false, status: 404 });
    expect(questionsOf(summary({ outbox: null }))).toMatchObject({ ok: false, status: 404 });
    expect(questionsOf(summary({ replies: null }))).toMatchObject({ ok: false, status: 404 });
    const merged = questionsOf(summary({ feature: { number: 12, url: 'https://x', state: 'merged', draft: false, mergedAt: '2026-09-28T00:00:00Z' } }));
    expect(merged).toMatchObject({ ok: false, status: 409, error: matching(/merged/) });
  });
});

describe('POST /api/outbox/send: the reply, written once and recorded as a send', () => {
  it('reads the outbox fresh, builds the reply from the checked picks, records it, and answers GitHub\'s authorisation', async () => {
    const w = world();
    const { status, body, cookie } = await w.start({ dossier: DOSSIER, picks: PICKS });

    expect(status).toBe(200);
    expect(w.outbox.reads).toEqual([DOSSIER]);
    const [send] = w.sends.sends;
    expect(sure(send, 'send').reply).toBe('1: ok\n2: B because orange is softer sneaky\n\n_answered on the Omni page · PRD 7_');
    expect(send).toMatchObject({ owner: 'u-ada', dossier_id: DOSSIER, pr_number: 12, nonce_hash: hash(NONCE), posted_at: null });
    expect(body.dropped).toEqual([]);
    const authorize = new URL(sure(body.authorize, 'body.authorize'));
    expect(authorize.origin + authorize.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(authorize.searchParams.get('client_id')).toBe('Iv1.client');
    expect(authorize.searchParams.get('redirect_uri')).toBe(`${ORIGIN}/prd/github/callback`);
    expect(authorize.searchParams.get('state')).toBe(`${sure(send, 'send').id}.${NONCE}`);
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
    expect(sure(w.sends.sends[0], 'the first send').reply).toBe('3: B because too big\n\n_answered on the Omni page · PRD 7_');
  });

  it('drops a pick whose question was settled meanwhile, and says so', async () => {
    const w = world();
    const { status, body } = await w.start({ dossier: DOSSIER, picks: [...PICKS, { number: 4, pick: 'A' }, { number: 9, pick: 'A' }] });
    expect(status).toBe(200);
    expect(body.dropped).toEqual([4, 9]);
    expect(sure(w.sends.sends[0], 'the first send').reply).not.toMatch(/^[49]:/m);
  });

  it('records nothing when every pick was settled meanwhile', async () => {
    const w = world();
    const { status, body } = await w.start({ dossier: DOSSIER, picks: [{ number: 4, pick: 'A' }] });
    expect(status).toBe(409);
    expect(body).toMatchObject({ dropped: [4], error: matching(/settled meanwhile/) });
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
    expect((await w.start({ dossier: DOSSIER, picks: [{ number: 1, pick: 'done', extra: 1 }] })).status).toBe(400);
    expect(w.outbox.reads).toEqual([]);
  });

  it('refuses a non-member: a dossier of another workspace answers not found, and GitHub is not read', async () => {
    const w = world();
    const { status } = await w.start({ dossier: ELSEWHERE, picks: PICKS });
    expect(status).toBe(404);
    expect(w.outbox.reads).toEqual([]);
    expect(w.sends.sends).toEqual([]);
    const eve = world({ viewer: 'u-eve' });
    expect((await eve.start({ dossier: DOSSIER, picks: PICKS })).status).toBe(404);
  });

  it('refuses once the feature pull request merged, and while GitHub is out of reach, recording nothing', async () => {
    const merged = world({ read: summary({ feature: { number: 12, url: 'https://x', state: 'merged', draft: false, mergedAt: '2026-09-28T00:00:00Z' } }) });
    const one = await merged.start({ dossier: DOSSIER, picks: PICKS });
    expect(one.status).toBe(409);
    expect(one.body.error).toMatch(/merged/);
    const down = world({ read: null });
    expect((await down.start({ dossier: DOSSIER, picks: PICKS })).status).toBe(503);
    expect([...merged.sends.sends, ...down.sends.sends]).toEqual([]);
  });

  it('asks to sign in first, and is off without the App\'s client id', async () => {
    const signedOut = world();
    signedOut.deps.store = () => Promise.resolve(null);
    expect((await signedOut.start({ dossier: DOSSIER, picks: PICKS })).status).toBe(401);
    expect((await world({ clientId: null }).start({ dossier: DOSSIER, picks: PICKS })).status).toBe(503);
  });
});

describe('/prd/github/callback: the reply posted once, as the person', () => {
  async function started(w = world()) {
    const { body } = await w.start({ dossier: DOSSIER, picks: PICKS });
    return { w, state: sure(new URL(sure(body.authorize, 'body.authorize')).searchParams.get('state'), 'the state'), id: sure(w.sends.sends[0], 'the first send').id };
  }

  it('trades the code, posts the reply on the feature pull request, records its link and author, drops the token and clears the cache', async () => {
    const log = vi.spyOn(console, 'error');
    const info = vi.spyOn(console, 'log');
    const warn = vi.spyOn(console, 'warn');
    const { w, state, id } = await started();
    const { status, location, cookie } = await w.back({ code: 'the-code', state });

    expect(status).toBe(303);
    expect(location).toBe(`${ORIGIN}/prd/${DOSSIER}?tab=outbox&send=${id}`);
    const [exchange, comment] = w.gh.calls;
    expect(sure(exchange, 'exchange').url).toBe('https://github.com/login/oauth/access_token');
    expect(JSON.parse(sure(exchange, 'exchange').body)).toEqual({ client_id: 'Iv1.client', client_secret: 'shh-client-secret', code: 'the-code' });
    expect(sure(comment, 'comment').url).toBe('https://api.github.com/repos/acme/widgets/issues/12/comments');
    expect(sure(comment, 'comment').method).toBe('POST');
    expect(sure(comment, 'comment').headers.authorization).toBe(`Bearer ${w.gh.token}`);
    expect(JSON.parse(sure(comment, 'comment').body)).toEqual({ body: sure(w.sends.sends[0], 'the first send').reply });
    expect(w.sends.sends[0]).toMatchObject({
      posted_at: A_STRING, comment_url: 'https://github.com/acme/widgets/pull/12#issuecomment-99', login: 'ada', counted: true, error: null,
    });
    // The dossier's cached summary is cleared, so the answer shows as pending at once.
    expect(w.outbox.forgotten).toEqual([DOSSIER]);
    // The token is never written to a cookie, a row or a log, nor sent back in the redirect.
    expect(cookie).toMatch(new RegExp(`${NONCE_COOKIE}=;`));
    expect(`${cookie} ${location}`).not.toContain(w.gh.token);
    expect(JSON.stringify(w.sends.sends)).not.toContain(w.gh.token);
    expect(JSON.stringify([...log.mock.calls, ...info.mock.calls, ...warn.mock.calls])).not.toContain(w.gh.token);
  });

  it('recounts the PRD\'s open questions once the reply is posted, and never when nothing was posted (PRD 657, s5)', async () => {
    const { w, state } = await started();
    const recounted: string[] = [];
    w.deps.recount = (dossierId) => { recounted.push(dossierId); return Promise.resolve(); };
    await w.back({ code: 'the-code', state });
    expect(recounted).toEqual([DOSSIER]);

    const refused = await started();
    const none: string[] = [];
    refused.w.deps.recount = (dossierId) => { none.push(dossierId); return Promise.resolve(); };
    await refused.w.back({ error: 'access_denied', state: refused.state });
    expect(none).toEqual([]);
  });

  it('still lands on the tab when the recount fails, and logs it', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { w, state, id } = await started();
    w.deps.recount = () => Promise.reject(new Error('Supabase is down'));
    const { location } = await w.back({ code: 'the-code', state });
    expect(location).toBe(`${ORIGIN}/prd/${DOSSIER}?tab=outbox&send=${id}`);
    expect(sure(w.sends.sends[0], 'the first send').posted_at).not.toBeNull();
    expect(log.mock.calls.flat().join('\n')).toContain('could not be recounted');
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
    // Bob, a member of the same workspace, comes back with Ada's state and even her nonce.
    const bob = world({ viewer: 'u-bob', gh: w.gh });
    (bob.sends.sends as unknown[]).push(...w.sends.sends);
    const { location } = await bob.back({ code: 'c', state });
    expect(location).toMatch(/send_error=state/);
    expect(w.gh.calls).toEqual([]);
    expect(w.sends.sends[0]).toMatchObject({ posted_at: null, error: null });
  });

  it('signed out, posts nothing and asks to sign in', async () => {
    const { w, state } = await started();
    w.deps.store = () => Promise.resolve(null);
    const { location } = await w.back({ code: 'c', state });
    expect(location).toMatch(/send_error=signin/);
    expect(w.gh.calls).toEqual([]);
  });

  it('an author GitHub lists as one the kit does not count is recorded as uncounted', async () => {
    const gh = fakeGitHub({ comment: { status: 201, body: { html_url: 'https://github.com/acme/widgets/pull/12#issuecomment-7', user: { login: 'visitor' }, author_association: 'CONTRIBUTOR' } } });
    const { w, state } = await started(world({ gh }));
    await w.back({ code: 'c', state });
    expect(w.sends.sends[0]).toMatchObject({ login: 'visitor', counted: false });
  });

  const FAILURES = [
    ['the authorisation refused', { exchange: { status: 200, body: { error: 'bad_verification_code' } } }, /authorisation was refused/],
    ['GitHub down', { exchange: 'down' as const }, /GitHub did not answer/],
    ['GitHub failing', { comment: { status: 502 } }, /GitHub did not answer/],
    ['no access', { comment: { status: 403, body: { message: 'Resource not accessible by integration' } } }, /may not comment/],
    ['the pull request gone', { comment: { status: 404, body: { message: 'Not Found' } } }, /is gone/],
  ] as const;

  for (const [what, answers, error] of FAILURES) {
    it(`${what}: posts nothing, records the error, and keeps the cache`, async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const { w, state, id } = await started(world({ gh: fakeGitHub(answers) }));
      const { location } = await w.back({ code: 'c', state });
      expect(location).toBe(`${ORIGIN}/prd/${DOSSIER}?tab=outbox&send=${id}`);
      expect(w.sends.sends[0]).toMatchObject({ posted_at: null, comment_url: null, error: matching(error) });
      expect(sure(w.sends.sends[0], 'the first send').error).not.toContain('ghu_');
      expect(w.outbox.forgotten).toEqual([]);
    });
  }

  it('the person refusing on GitHub posts nothing and records it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { w, state } = await started();
    await w.back({ error: 'access_denied', error_description: 'The user has denied your application access.', state });
    expect(w.gh.calls).toEqual([]);
    expect(sure(w.sends.sends[0], 'the first send').error).toMatch(/authorisation was refused/);
  });
});

describe('GET /api/outbox/send: the result, for the tab', () => {
  const get = async (w: ReturnType<typeof world>, query: string) => {
    const response = await readSend(new Request(`${ORIGIN}/api/outbox/send?${query}`), w.deps);
    return { status: response.status, body: (await response.json()) as unknown };
  };

  it('the owner reads their send\'s outcome, with the next step', async () => {
    const w = world();
    const { body } = await w.start({ dossier: DOSSIER, picks: PICKS });
    await w.back({ code: 'c', state: sure(new URL(sure(body.authorize, 'body.authorize')).searchParams.get('state'), 'the state') });
    const { status, body: sent } = await get(w, `id=${sure(w.sends.sends[0], 'the first send').id}`);
    expect(status).toBe(200);
    expect(sent).toMatchObject({ state: 'posted', login: 'ada', next: '/omni:yolo-fix 7', counted: true });
    expect(JSON.stringify(sent)).not.toContain('nonce');
  });

  it('another person\'s send, or none, answers not found; signed out, 401; a malformed id, 400', async () => {
    const w = world();
    await w.start({ dossier: DOSSIER, picks: PICKS });
    const bob = world({ viewer: 'u-bob' });
    (bob.sends.sends as unknown[]).push(...w.sends.sends);
    expect((await get(bob, `id=${sure(w.sends.sends[0], 'the first send').id}`)).status).toBe(404);
    expect((await get(w, 'id=nope')).status).toBe(400);
    w.deps.store = () => Promise.resolve(null);
    expect((await get(w, `id=${sure(w.sends.sends[0], 'the first send').id}`)).status).toBe(401);
  });
});

describe('the result on the tab', () => {
  const row = {
    id: 's1', dossier_id: DOSSIER, pr_number: 12, reply: '2: B\n\n_answered on the Omni page · PRD 7_', nonce_hash: 'h',
    created_at: '2026-09-28T10:05:00Z', posted_at: null as string | null, comment_url: null as string | null,
    login: null as string | null, counted: null as boolean | null, error: null as string | null,
  };

  it('posted: sent as @login, its link, and the next step', () => {
    expect(sentView({ ...row, posted_at: '2026-09-28T10:06:00Z', comment_url: 'https://x/1', login: 'ada', counted: true }, 7, null)).toEqual({
      state: 'posted', login: 'ada', url: 'https://x/1', counted: true, next: '/omni:yolo-fix 7', reply: row.reply, at: '2026-09-28T10:06:00Z',
    });
  });

  it('failed: the error; waiting: nothing recorded yet; a wrong state says why', () => {
    expect(sentView({ ...row, error: 'GitHub did not answer.' }, 7, null)).toEqual({ state: 'failed', error: 'GitHub did not answer.' });
    expect(sentView(row, 7, null)).toEqual({ state: 'waiting' });
    expect(sentView(null, 7, 'state')).toMatchObject({ state: 'failed', error: matching(/did not match/) });
    expect(sentView(null, 7, null)).toBeNull();
  });

  it('an uncounted author is named, with what it means', () => {
    expect(UNCOUNTED('visitor')).toMatch(/@visitor.*\/omni:yolo-fix will not read/);
  });
});
