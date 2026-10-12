import { describe, expect, it, vi } from 'vitest';
import type { AskReads } from './ask.service';
import { DossierRoundsSchema, QuestionStateSchema, SessionStateSchema, TabsSchema } from './ask.contract';

vi.mock('server-only', () => ({}));
vi.mock('../data/viewer', () => ({ viewer: () => Promise.resolve({ kind: 'sign-in' }) }));

const { askReadHandlers, getTabs } = await import('./ask.controller');

// The ask pages' read routes (PRD 1318, s2), on a fake service: signed out → 401 `signed-out` and
// the service never called; another workspace's session or round → 404 `not-found`; an id that is no
// uuid → 422 `invalid` naming it; a failed read → 500 `database`; signed in, the contract's shapes.

const ME = '00000000-0000-4000-8000-0000000000a1';
const SESSION_ID = '00000000-0000-4000-8000-000000000001';
const ROUND_ID = '00000000-0000-4000-8000-000000000002';
const NOW = Date.parse('2026-10-09T09:00:00Z');

const session = {
  id: SESSION_ID, owner: ME, title: 'vertuo-omni-loop · feat/x', status: 'open', created_at: '2026-10-09T08:00:00Z', last_seen_at: '2026-10-09T08:59:00Z',
  workspace_id: '00000000-0000-4000-8000-00000000a0a0', repo: null, branch: null, claude_session_id: null,
} as const;
const round = {
  id: ROUND_ID, questions: [{ question: 'Which?', header: 'Pick', options: [] }], answers: null, answered_via: null, status: 'open', created_at: '2026-10-09T08:30:00Z',
  answered_at: null, attachments: null, prd: null, skill: null, model: null, tokens: null, cost_usd: null, answered_by: null, category: null, category_by: null, lead: null,
} as const;

/** A fake service that records each call, answering `found` (or throwing `fails`). */
function fakeReads(found: 'found' | 'missing' | 'fails' = 'found') {
  const calls: string[] = [];
  const give = <T>(what: string, value: T): Promise<T | null> => {
    calls.push(what);
    if (found === 'fails') return Promise.reject(new Error('connection lost'));
    return Promise.resolve(found === 'missing' ? null : value);
  };
  const reads = {
    tabs: (owner: string, now: number) => give(`tabs ${owner} ${now}`, [{ session, newest: null }]).then((t) => t ?? []),
    session: (id: string) => give(`session ${id}`, { session, rounds: [round], ping: null }),
    question: (id: string) => give(`question ${id}`, { session, round, earlier: [], sharedWith: [] }),
  } as unknown as AskReads;
  return { calls, reads };
}

const signedIn = (reads: AskReads) => askReadHandlers({ signedIn: () => Promise.resolve({ userId: ME, reads }), now: () => NOW });
const signedOut = () => askReadHandlers({ signedIn: () => Promise.resolve(null), now: () => NOW });
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const request = new Request('https://galaxy.test/api/ask/x');

describe('signed out', () => {
  it('answers 401 signed-out on each of the three reads, and calls no service', async () => {
    const handlers = signedOut();
    for (const response of [await handlers.tabs(), await handlers.session(request, params(SESSION_ID)), await handlers.round(request, params(ROUND_ID))]) {
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: 'signed-out' });
    }
  });

  it('answers 401 before it reads the id', async () => {
    const response = await signedOut().session(request, params('not-a-uuid'));
    expect(response.status).toBe(401);
  });

  it('the live route reads the viewer: nobody signed in is 401', async () => {
    const response = await getTabs();
    expect([response.status, await response.json()]).toEqual([401, { error: 'signed-out' }]);
  });
});

describe('signed in', () => {
  it('reads the person\'s tabs, as the contract says', async () => {
    const { calls, reads } = fakeReads();
    const response = await signedIn(reads).tabs();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(TabsSchema.parse(await response.json()).tabs).toHaveLength(1);
    expect(calls).toEqual([`tabs ${ME} ${NOW}`]);
  });

  it('reads a session and a round, as the contract says', async () => {
    const { calls, reads } = fakeReads();
    const handlers = signedIn(reads);
    expect(SessionStateSchema.parse(await (await handlers.session(request, params(SESSION_ID))).json()).rounds).toHaveLength(1);
    expect(QuestionStateSchema.parse(await (await handlers.round(request, params(ROUND_ID))).json()).round.id).toBe(ROUND_ID);
    expect(calls).toEqual([`session ${SESSION_ID}`, `question ${ROUND_ID}`]);
  });

  it('answers 404 not-found for a session or round it cannot read (another workspace, or none)', async () => {
    const handlers = signedIn(fakeReads('missing').reads);
    for (const response of [await handlers.session(request, params(SESSION_ID)), await handlers.round(request, params(ROUND_ID))]) {
      expect([response.status, await response.json()]).toEqual([404, { error: 'not-found' }]);
    }
  });

  it('answers 422 invalid, naming the id, for an id that is no uuid, and reads nothing', async () => {
    const { calls, reads } = fakeReads();
    const response = await signedIn(reads).round(request, params('nope'));
    expect([response.status, await response.json()]).toEqual([422, { error: 'invalid', field: 'id' }]);
    expect(calls).toEqual([]);
  });

  it('answers 500 database when a read fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const handlers = signedIn(fakeReads('fails').reads);
    for (const response of [await handlers.tabs(), await handlers.session(request, params(SESSION_ID))]) {
      expect([response.status, await response.json()]).toEqual([500, { error: 'database' }]);
    }
  });
});

describe('GET /api/ask/dossiers/:id/rounds: the way back (PRD 384; PRD 1318, s3)', () => {
  const DOSSIER = '00000000-0000-4000-8000-00000000d055';
  const rounds = [{ round_id: ROUND_ID, status: 'open' as const, created_at: '2026-10-09T08:30:00Z' }];
  const withWayBack = (wayBack: (id: string) => Promise<typeof rounds>) =>
    askReadHandlers({ signedIn: () => Promise.resolve({ userId: ME, reads: fakeReads().reads, wayBack }), now: () => NOW });

  it('answers 401 signed-out, and reads nothing', async () => {
    const response = await signedOut().dossierRounds(request, params(DOSSIER));
    expect([response.status, await response.json()]).toEqual([401, { error: 'signed-out' }]);
  });

  it('reads which of the dossier\'s rounds are open, as the person', async () => {
    const asked: string[] = [];
    const response = await withWayBack((id) => {
      asked.push(id);
      return Promise.resolve(rounds);
    }).dossierRounds(request, params(DOSSIER));
    expect([response.status, DossierRoundsSchema.parse(await response.json())]).toEqual([200, { rounds }]);
    expect(asked).toEqual([DOSSIER]);
  });

  it('answers 422 for an id that is no dossier\'s, and 500 database when the read fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const handlers = withWayBack(() => Promise.reject(new Error('connection lost')));
    expect((await handlers.dossierRounds(request, params('nope'))).status).toBe(422);
    expect((await handlers.dossierRounds(request, params(DOSSIER))).status).toBe(500);
  });
});
