import { describe, expect, it } from 'vitest';
import { COULD_NOT_SAVE, COULD_NOT_SAVE_DECISION, DEMO_REFUSAL, demoJevPort, httpJevPort } from './port';

// Settings › Jev's key calls from the browser (PRD 812 s1): the key routes over a stubbed fetch, and the
// demo's rules in memory.

const W = 'ws-1';
const STORED = { stored: true, lastFour: '1a2b', setAt: '2026-09-30T10:00:00Z' };

function stub(res: Response | Error) {
  const calls: Array<{ url: string; method: string; body: unknown }> = [];
  const fetch = ((url: string, init: RequestInit) => {
    calls.push({ url, method: String(init.method), body: JSON.parse(String(init.body)) });
    if (res instanceof Error) return Promise.reject(res);
    return Promise.resolve(res);
  }) as unknown as typeof globalThis.fetch;
  return { fetch, calls };
}

describe('the key routes, from the browser', () => {
  it('posts the key with the workspace, and answers the stored status', async () => {
    const { fetch, calls } = stub(Response.json({ key: STORED }));
    expect(await httpJevPort(W, fetch).saveKey('ts_live_1a2b')).toEqual({ ok: true, key: STORED });
    expect(calls).toEqual([{ url: '/api/jev/key', method: 'POST', body: { workspace: W, key: 'ts_live_1a2b' } }]);
  });

  it('deletes the key with the workspace', async () => {
    const none = { stored: false, lastFour: null, setAt: null };
    const { fetch, calls } = stub(Response.json({ key: none }));
    expect(await httpJevPort(W, fetch).removeKey()).toEqual({ ok: true, key: none });
    expect(calls).toEqual([{ url: '/api/jev/key', method: 'DELETE', body: { workspace: W } }]);
  });

  it('says the route\'s refusal, TypeSafe\'s reason included', async () => {
    const { fetch } = stub(Response.json({ error: 'TypeSafe refused this key: Invalid API key' }, { status: 422 }));
    expect(await httpJevPort(W, fetch).saveKey('ts_live_1a2b')).toEqual({ ok: false, message: 'TypeSafe refused this key: Invalid API key' });
  });

  it('says it could not save on a network error or an answer it cannot read', async () => {
    expect(await httpJevPort(W, stub(new TypeError('offline')).fetch).saveKey('k')).toEqual({ ok: false, message: COULD_NOT_SAVE });
    expect(await httpJevPort(W, stub(new Response('<html>', { status: 502 })).fetch).removeKey()).toEqual({ ok: false, message: COULD_NOT_SAVE });
  });
});

describe('the demo', () => {
  it('saves a key, keeping its last four, and refuses one TypeSafe would refuse', async () => {
    const port = demoJevPort(() => Date.parse('2026-09-30T10:00:00Z'));
    expect(await port.saveKey(' ts_demo_9z9z ')).toEqual({ ok: true, key: { stored: true, lastFour: '9z9z', setAt: '2026-09-30T10:00:00.000Z' } });
    expect(await port.saveKey('bad_key_0000')).toEqual({ ok: false, message: DEMO_REFUSAL });
    expect(await port.saveKey('short')).toEqual({ ok: false, message: DEMO_REFUSAL });
    expect(await port.removeKey()).toEqual({ ok: true, key: { stored: false, lastFour: null, setAt: null } });
  });
});

describe('a decision\'s settings, from the browser (PRD 812 s2)', () => {
  const ON = { decision: 'question-category', mode: 'on' as const, threshold: 0.65, floor: 0.3 };

  it('goes through the page\'s server action with the workspace, and answers what it answered', async () => {
    const sent: unknown[] = [];
    const port = httpJevPort(W, globalThis.fetch, (workspace, settings) => { sent.push([workspace, settings]); return Promise.resolve({ ok: true, settings }); });
    expect(await port.saveDecision(ON)).toEqual({ ok: true, settings: ON });
    expect(sent).toEqual([[W, ON]]);
  });

  it('says it could not save when the action throws, or when there is none', async () => {
    expect(await httpJevPort(W, globalThis.fetch, () => Promise.reject(new Error('offline'))).saveDecision(ON)).toEqual({ ok: false, message: COULD_NOT_SAVE_DECISION });
    expect(await httpJevPort(W).saveDecision(ON)).toEqual({ ok: false, message: COULD_NOT_SAVE_DECISION });
  });

  it('saves as sent in the demo', async () => {
    expect(await demoJevPort().saveDecision(ON)).toEqual({ ok: true, settings: ON });
  });
});
