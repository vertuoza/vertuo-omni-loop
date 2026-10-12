import { afterEach, describe, expect, it, vi } from 'vitest';
import { askClient, AskReadFailed, AskSignedOut, type Fetch } from './ask.client';
import { POLL_MS, poll, readTick } from './page/poll';

// The ask pages' reads from the browser (PRD 1318, s2), on a fake fetch: each route's response parsed
// with the contract; 401 throws AskSignedOut (the page stops polling and shows the sign-in card); 404
// reads as null; a 500, or a body the contract refuses, throws, and the page keeps its last data.

const SESSION_ID = '00000000-0000-4000-8000-000000000001';
const ROUND_ID = '00000000-0000-4000-8000-000000000002';

const session = {
  id: SESSION_ID, owner: 'ada', title: 'vertuo-omni-loop · feat/x', status: 'open', created_at: '2026-10-09T08:00:00Z', last_seen_at: '2026-10-09T08:59:00Z',
  workspace_id: null, repo: 'vertuo-omni-loop', branch: 'feat/x', claude_session_id: 'claude-1',
};
const round = {
  id: ROUND_ID, questions: [{ question: 'Which?' }], answers: { 'Which?': 'A' }, answered_via: 'page', status: 'answered', created_at: '2026-10-09T08:30:00Z',
  answered_at: '2026-10-09T08:31:00Z', attachments: null, prd: 1318, skill: 'do-work', model: 'opus', tokens: { input: 1, output: 2, cacheRead: 3, cacheWrite: 4 },
  cost_usd: 0.5, answered_by: 'ada', category: 'product', category_by: 'model', lead: null,
};

/** A fetch that answers `status` and `body`, and the URLs it was called with. */
function fakeFetch(status: number, body: unknown) {
  const urls: string[] = [];
  const fetchFn: Fetch = (url) => {
    urls.push(url);
    return Promise.resolve(Response.json(body, { status }));
  };
  return { urls, fetchFn };
}

describe('reading through the routes', () => {
  it('reads the tabs, a session and a round, each parsed with the contract', async () => {
    const tabs = fakeFetch(200, { tabs: [{ session, newest: { id: ROUND_ID, status: 'open', created_at: round.created_at, header: 'Pick' } }] });
    expect(await askClient(tabs.fetchFn).tabs()).toEqual([{ session, newest: { id: ROUND_ID, status: 'open', created_at: round.created_at, header: 'Pick' } }]);
    expect(tabs.urls).toEqual(['/api/ask/tabs']);

    const one = fakeFetch(200, { session, rounds: [round], ping: { seen_at: '2026-10-09T08:59:00Z', ended_at: null } });
    expect((await askClient(one.fetchFn).session(SESSION_ID))?.rounds).toEqual([round]);
    expect(one.urls).toEqual([`/api/ask/sessions/${SESSION_ID}`]);

    const question = fakeFetch(200, { session, round, earlier: [], sharedWith: ['bob'] });
    expect((await askClient(question.fetchFn).round(ROUND_ID))?.sharedWith).toEqual(['bob']);
    expect(question.urls).toEqual([`/api/ask/rounds/${ROUND_ID}`]);
  });

  it('reads a fact an odd row holds as unknown, rather than failing the poll', async () => {
    const odd = fakeFetch(200, { session, rounds: [{ ...round, category: 'nonsense', tokens: 'many' }] });
    expect((await askClient(odd.fetchFn).session(SESSION_ID))?.rounds[0]).toMatchObject({ category: null, tokens: null });
  });
});

describe('refusals', () => {
  it('throws AskSignedOut on a 401, on every read', async () => {
    const { fetchFn } = fakeFetch(401, { error: 'signed-out' });
    await expect(askClient(fetchFn).tabs()).rejects.toBeInstanceOf(AskSignedOut);
    await expect(askClient(fetchFn).session(SESSION_ID)).rejects.toBeInstanceOf(AskSignedOut);
    await expect(askClient(fetchFn).round(ROUND_ID)).rejects.toBeInstanceOf(AskSignedOut);
  });

  it('reads a session or round that is gone, or of another workspace, as null', async () => {
    const { fetchFn } = fakeFetch(404, { error: 'not-found' });
    expect(await askClient(fetchFn).session(SESSION_ID)).toBeNull();
    expect(await askClient(fetchFn).round(ROUND_ID)).toBeNull();
  });

  it('throws on a 500, naming its kind, so the page keeps its last data', async () => {
    const { fetchFn } = fakeFetch(500, { error: 'database' });
    await expect(askClient(fetchFn).session(SESSION_ID)).rejects.toMatchObject({ name: 'AskReadFailed', status: 500, kind: 'database' });
    await expect(askClient(fakeFetch(502, 'Bad gateway').fetchFn).tabs()).rejects.toBeInstanceOf(AskReadFailed);
  });

  it('throws on a body the contract refuses', async () => {
    await expect(askClient(fakeFetch(200, { tabs: [{ session: { id: 1 } }] }).fetchFn).tabs()).rejects.toThrow();
  });
});

describe('a page polling through the client', () => {
  afterEach(() => vi.useRealTimers());
  const visible = { visibilityState: 'visible', addEventListener: () => undefined, removeEventListener: () => undefined };

  /** Polls a session every 2 s as the pages do, on a fetch answering `status`; what was fetched and heard. */
  function polling(statuses: number[]) {
    vi.useFakeTimers();
    let calls = 0;
    const fetchFn: Fetch = () => {
      const status = statuses[Math.min(calls, statuses.length - 1)] ?? 500;
      calls += 1;
      return Promise.resolve(Response.json(status === 200 ? { session, rounds: [] } : { error: status === 401 ? 'signed-out' : 'database' }, { status }));
    };
    const client = askClient(fetchFn);
    const heard = { signedOut: 0, kept: 0, read: 0, gone: 0 };
    const stop = poll(readTick({
      read: () => client.session(SESSION_ID),
      gone: () => {
        heard.gone += 1;
      },
      seen: () => {
        heard.read += 1;
        return true;
      },
      failed: () => {
        heard.kept += 1;
      },
      signedOut: () => {
        heard.signedOut += 1;
      },
    }), visible);
    return { heard, stop, calls: () => calls };
  }

  it('stops after its first 401, tells the page once, and asks nothing again', async () => {
    const p = polling([200, 401, 200]);
    await vi.advanceTimersByTimeAsync(POLL_MS * 2);
    expect(p.heard).toEqual({ signedOut: 1, kept: 0, read: 1, gone: 0 });
    await vi.advanceTimersByTimeAsync(POLL_MS * 10);
    expect(p.calls()).toBe(2);
    p.stop();
  });

  it('stops on a session that is gone, and the page reloads', async () => {
    const p = polling([404]);
    await vi.advanceTimersByTimeAsync(POLL_MS * 3);
    expect(p.heard).toEqual({ signedOut: 0, kept: 0, read: 0, gone: 1 });
    p.stop();
  });

  it('keeps polling on a 500, the page keeping its last data', async () => {
    const p = polling([500, 500, 200]);
    await vi.advanceTimersByTimeAsync(POLL_MS * 3);
    expect(p.heard).toEqual({ signedOut: 0, kept: 2, read: 1, gone: 0 });
    p.stop();
  });
});
