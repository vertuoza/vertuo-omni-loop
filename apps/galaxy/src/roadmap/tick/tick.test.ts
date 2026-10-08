import { describe, expect, it, vi } from 'vitest';
import { readTicks } from 'vertuo-omni-plan/kit/lib/roadmap/prereqs/ticks.ts';
import { parseIssue } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { fakeGitHub } from '../../outbox/send.fake';
import { githubUser } from '../../outbox/send';
import { sure } from '../../arcade/test/sure';
import { finishTick, isTickState, startTick, TICK_COOKIE, tickCallbackPath, tickGitHub, type TickDeps, type TickStore, type TickTarget } from './tick';

vi.mock('server-only', () => ({}));

// Mark as done (PRD 1218, s7): a `person` prerequisite of a roadmap ticked from its Prerequisites tab, as
// the signed-in member, through the omni-loop App's user authorisation as the outbox send does. The start
// checks the person reads the roadmap and that the row is a `person` one, and answers GitHub's
// authorisation; the callback checks the state against its cookie, trades the code for a user token,
// posts the kit's tick comment on the roadmap's issue with it, drops the token and goes back to the tab.
// A fake store, a fake GitHub over fetch: no test calls GitHub or Supabase.

const ROADMAP = '00000000-0000-4000-8000-0000000000a1';
const ELSEWHERE = '00000000-0000-4000-8000-0000000000e2';
const ORIGIN = 'https://omni.example';
const NONCE = 'n0nce-n0nce-n0nce-n0nce-n0nce-n0nce-0000';
const STATE = `tick~${ROADMAP}~p6~${NONCE}`;

type Fake = { id: string; repo: string; number: number; members: string[]; rows: Record<string, 'agent' | 'check' | 'person'> };
const ROADMAPS: Fake[] = [
  { id: ROADMAP, repo: 'acme/crew', number: 1162, members: ['u-ada'], rows: { p1: 'agent', p5: 'check', p6: 'person' } },
  { id: ELSEWHERE, repo: 'other/place', number: 9, members: ['u-eve'], rows: { p1: 'person' } },
];

/** The roadmaps as `viewer` reads them: another workspace's reads as none, as row-level security does. */
function fakeStore(viewer: string): TickStore & { reads: string[] } {
  const reads: string[] = [];
  return {
    reads,
    target(roadmapId: string): Promise<TickTarget | null> {
      reads.push(roadmapId);
      const found = ROADMAPS.find((r) => r.id === roadmapId && r.members.includes(viewer));
      return Promise.resolve(found ? { roadmapId: found.id, repo: found.repo, number: parseIssue(found.number), rows: found.rows } : null);
    },
  };
}

function world({ viewer = 'u-ada' as string | null, gh = fakeGitHub(), clientId = 'Iv1.client' as string | null } = {}) {
  const store = viewer === null ? null : fakeStore(viewer);
  const deps: TickDeps = {
    clientId,
    store: () => Promise.resolve(store),
    github: () => tickGitHub(githubUser({ clientId: 'Iv1.client', clientSecret: 'shh-client-secret', fetch: gh.fetch })),
    nonce: () => NONCE,
  };
  const start = async (body: unknown) => {
    const response = await startTick(new Request(`${ORIGIN}/api/roadmaps/tick`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body),
    }), deps);
    return { status: response.status, body: (await response.json()) as { authorize?: string; error?: string }, cookie: response.headers.get('set-cookie') };
  };
  const back = async (query: Record<string, string>, cookie: string | null = `${ROADMAP}~p6~${NONCE}`) => {
    const url = new URL(`${ORIGIN}${tickCallbackPath}`);
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    const response = await finishTick(new Request(url, { headers: cookie === null ? {} : { cookie: `other=1; ${TICK_COOKIE}=${cookie}` } }), deps);
    return { status: response.status, location: response.headers.get('location'), cookie: response.headers.get('set-cookie') };
  };
  return { store, gh, start, back };
}

const TAB = `${ORIGIN}/roadmaps/${ROADMAP}?tab=prerequisites`;

describe('POST /api/roadmaps/tick: the authorisation that ticks a person row', () => {
  it('answers GitHub\'s authorisation of the omni-loop App, its state naming the roadmap, the row and a nonce its cookie carries', async () => {
    const w = world();
    const { status, body, cookie } = await w.start({ roadmap: ROADMAP, row: 'p6' });
    expect(status).toBe(200);
    const authorize = new URL(sure(body.authorize, 'body.authorize'));
    expect(authorize.origin + authorize.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(authorize.searchParams.get('client_id')).toBe('Iv1.client');
    expect(authorize.searchParams.get('redirect_uri')).toBe(`${ORIGIN}/prd/github/callback`);
    expect(authorize.searchParams.get('state')).toBe(STATE);
    expect(cookie).toContain(`${TICK_COOKIE}=${ROADMAP}~p6~${NONCE}`);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Path=\/prd\/github\/callback/);
    expect(cookie).toMatch(/Max-Age=600/);
    expect(w.gh.calls).toEqual([]);
  });

  it('refuses a row that is not a person row, or no row of the roadmap', async () => {
    const w = world();
    for (const row of ['p1', 'p5']) {
      const { status, body, cookie } = await w.start({ roadmap: ROADMAP, row });
      expect(status).toBe(409);
      expect(body.error).toMatch(/only a person row/i);
      expect(cookie).toBeNull();
    }
    expect((await w.start({ roadmap: ROADMAP, row: 'p9' })).status).toBe(404);
  });

  it('refuses a roadmap the person is no member of, as not found', async () => {
    expect((await world().start({ roadmap: ELSEWHERE, row: 'p1' })).status).toBe(404);
  });

  it('refuses a malformed body, reading nothing', async () => {
    const w = world();
    for (const body of ['not json', { roadmap: 'nope', row: 'p6' }, { roadmap: ROADMAP, row: 'p 6' }, { roadmap: ROADMAP }, { roadmap: ROADMAP, row: 'p6', extra: 1 }]) {
      expect((await w.start(body)).status).toBe(400);
    }
    expect(w.store?.reads).toEqual([]);
  });

  it('asks to sign in first, and says marking is not open where the App\'s client is missing', async () => {
    expect((await world({ viewer: null }).start({ roadmap: ROADMAP, row: 'p6' })).status).toBe(401);
    const closed = await world({ clientId: null }).start({ roadmap: ROADMAP, row: 'p6' });
    expect(closed.status).toBe(503);
    expect(closed.body.error).toContain('omni roadmap tick');
  });
});

describe('the callback: the tick posted once, as the person', () => {
  it('trades the code, posts the kit\'s tick comment on the roadmap\'s issue with the user token, and goes back to the tab, the row ticked', async () => {
    const w = world();
    const { status, location, cookie } = await w.back({ code: 'c0de', state: STATE });
    expect(status).toBe(303);
    expect(location).toBe(`${TAB}&ticked=p6`);
    expect(cookie).toMatch(new RegExp(`${TICK_COOKIE}=;.*Max-Age=0`));
    const [exchange, comment] = w.gh.calls;
    expect(JSON.parse(sure(exchange, 'the exchange').body)).toMatchObject({ client_id: 'Iv1.client', code: 'c0de' });
    expect(sure(comment, 'the comment').url).toBe('https://api.github.com/repos/acme/crew/issues/1162/comments');
    expect(sure(comment, 'the comment').headers.authorization).toBe(`Bearer ${w.gh.token}`);
    // The next `omni roadmap prereqs` reads it back as a tick of p6.
    const { body } = JSON.parse(sure(comment, 'the comment').body) as { body: string };
    expect(readTicks([{ body } as never])).toEqual(new Set(['p6']));
    expect(location).not.toContain(w.gh.token);
  });

  it('posts nothing on a state its cookie does not carry, or no cookie, or another row than the cookie\'s', async () => {
    for (const cookie of [null, `${ROADMAP}~p6~another-nonce-another-nonce-00`, `${ROADMAP}~p7~${NONCE}`]) {
      const w = world();
      const { location } = await w.back({ code: 'c0de', state: STATE }, cookie);
      expect(location).toBe(`${TAB}&tick_error=state`);
      expect(w.gh.calls).toEqual([]);
    }
  });

  it('posts nothing on a state that names no tick, nor for a person signed out', async () => {
    const w = world();
    expect((await w.back({ code: 'c0de', state: 'nonsense' })).location).toBe(`${ORIGIN}/roadmaps?tick_error=state`);
    expect((await world({ viewer: null }).back({ code: 'c0de', state: STATE })).location).toBe(`${ORIGIN}/roadmaps?tick_error=signin`);
    expect(w.gh.calls).toEqual([]);
  });

  it('posts nothing for a roadmap the person no longer reads, or a row no longer a person one', async () => {
    const eve = world({ viewer: 'u-eve' });
    expect((await eve.back({ code: 'c0de', state: STATE })).location).toBe(`${TAB}&tick_error=gone`);
    expect(eve.gh.calls).toEqual([]);
    const w = world();
    const p5 = `tick~${ROADMAP}~p5~${NONCE}`;
    expect((await w.back({ code: 'c0de', state: p5 }, `${ROADMAP}~p5~${NONCE}`)).location).toBe(`${TAB}&tick_error=not-person`);
    expect(w.gh.calls).toEqual([]);
  });

  it('says why GitHub posted nothing: the authorisation refused, GitHub down, no access to the issue', async () => {
    expect((await world().back({ error: 'access_denied', state: STATE })).location).toBe(`${TAB}&tick_error=refused`);
    const down = world({ gh: fakeGitHub({ comment: 'down' }) });
    expect((await down.back({ code: 'c0de', state: STATE })).location).toBe(`${TAB}&tick_error=down`);
    const forbidden = world({ gh: fakeGitHub({ comment: { status: 403, body: {} } }) });
    expect((await forbidden.back({ code: 'c0de', state: STATE })).location).toBe(`${TAB}&tick_error=no-access`);
  });
});

describe('isTickState: which callback a state belongs to', () => {
  it('tells a tick\'s state from an outbox send\'s', () => {
    expect(isTickState(new Request(`${ORIGIN}${tickCallbackPath}?code=c&state=${STATE}`))).toBe(true);
    expect(isTickState(new Request(`${ORIGIN}${tickCallbackPath}?code=c&state=${ROADMAP}.${NONCE}`))).toBe(false);
    expect(isTickState(new Request(`${ORIGIN}${tickCallbackPath}?code=c`))).toBe(false);
  });
});
