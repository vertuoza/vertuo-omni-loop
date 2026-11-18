import { parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { describe, expect, it } from 'vitest';
import { COULD_NOT, demoMissionsPort, httpMissionsPort } from './missions-tab.client';

// The tab's calls from the browser (PRD 2842 s7): POST /api/missions/<id>/<action>; the move done, or the
// refusal's words.

const ID = '11111111-1111-4111-8111-111111111111';

function fetchAnswering(status: number, body: unknown) {
  const sent: { url: string; method: string | undefined }[] = [];
  const fetch: typeof globalThis.fetch = (url, init) => {
    sent.push({ url: typeof url === 'string' ? url : url instanceof URL ? url.href : url.url, method: init?.method });
    return Promise.resolve(new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }));
  };
  return { fetch, sent };
}

describe('the missions client', () => {
  it('posts the action to the mission\'s route', async () => {
    const { fetch, sent } = fetchAnswering(200, { mission: { id: ID, status: 'running' } });
    expect(await httpMissionsPort(fetch).move(ID, 'start')).toEqual({ ok: true });
    expect(sent).toEqual([{ url: `/api/missions/${ID}/start`, method: 'POST' }]);
  });

  it('carries a refusal\'s words', async () => {
    const { fetch } = fetchAnswering(409, { error: 'Only a draft mission starts.' });
    expect(await httpMissionsPort(fetch).move(ID, 'start')).toEqual({ ok: false, message: 'Only a draft mission starts.' });
  });

  it('says it could not when the answer is not the contract\'s, or the call fails', async () => {
    expect(await httpMissionsPort(fetchAnswering(200, { nope: 1 }).fetch).move(ID, 'pause')).toEqual({ ok: false, message: COULD_NOT });
    expect(await httpMissionsPort(fetchAnswering(500, 'html').fetch).move(ID, 'pause')).toEqual({ ok: false, message: COULD_NOT });
    const failing: typeof globalThis.fetch = () => Promise.reject(new Error('offline'));
    expect(await httpMissionsPort(failing).move(ID, 'resume')).toEqual({ ok: false, message: COULD_NOT });
  });

  it('posts the level to the mission\'s level route, and carries the refusal\'s words (PRD 2896)', async () => {
    const sent: { url: string; body: unknown }[] = [];
    const fetch: typeof globalThis.fetch = (url, init) => {
      sent.push({ url: typeof url === 'string' ? url : '', body: JSON.parse(typeof init?.body === 'string' ? init.body : '{}') });
      return Promise.resolve(new Response(JSON.stringify({ mission: { id: ID, level: 'own-branch' } }), { status: 200 }));
    };
    expect(await httpMissionsPort(fetch).setLevel(ID, 'own-branch')).toEqual({ ok: true });
    expect(sent).toEqual([{ url: `/api/missions/${ID}/level`, body: { level: 'own-branch' } }]);
    const { fetch: refusing } = fetchAnswering(403, { error: 'Only an owner of the workspace takes a mission above its fleet\'s level.' });
    expect(await httpMissionsPort(refusing).setLevel(ID, 'alone')).toEqual({ ok: false, message: 'Only an owner of the workspace takes a mission above its fleet\'s level.' });
  });

  it('posts a pick on Decide the bugs to the mission\'s bugs route (PRD 3001)', async () => {
    const sent: { url: string; body: unknown }[] = [];
    const fetch: typeof globalThis.fetch = (url, init) => {
      sent.push({ url: typeof url === 'string' ? url : '', body: JSON.parse(typeof init?.body === 'string' ? init.body : '{}') });
      return Promise.resolve(new Response(JSON.stringify({ bugs: { mission: ID, prd: 3001, pick: 'stop' } }), { status: 200 }));
    };
    expect(await httpMissionsPort(fetch).pickBugs(ID, parsePrd(3001), 'stop')).toEqual({ ok: true });
    expect(sent).toEqual([{ url: `/api/missions/${ID}/bugs`, body: { prd: 3001, pick: 'stop' } }]);
    expect((await demoMissionsPort.pickBugs(ID, parsePrd(3001), 'review')).ok).toBe(false);
  });

  it('moves nothing in the demo', async () => {
    expect((await demoMissionsPort.move(ID, 'start')).ok).toBe(false);
    expect((await demoMissionsPort.setLevel(ID, 'alone')).ok).toBe(false);
  });
});

// The token caps' calls (PRD 3040 s4).
describe('the token calls', () => {
  const sentTo = () => {
    const sent: { url: string; body: unknown }[] = [];
    const fetch: typeof globalThis.fetch = (url, init) => {
      sent.push({ url: typeof url === 'string' ? url : url instanceof URL ? url.href : url.url, body: JSON.parse(typeof init?.body === 'string' ? init.body : 'null') });
      return Promise.resolve(new Response(JSON.stringify(sent.length === 1 ? { mission: { id: ID, tokens: 5 } } : sent.length === 2 ? { stop: { id: ID, answer: 'raised', raisedTo: 9 } } : { fleet: { name: 'night-shift', dailyTokens: null } }), { status: 200 }));
    };
    return { fetch, sent };
  };

  it('posts a mission\'s budget, a stop\'s answer and the fleet\'s cap to their routes', async () => {
    const { fetch, sent } = sentTo();
    const port = httpMissionsPort(fetch);
    expect(await port.setBudget(ID, 5)).toEqual({ ok: true });
    expect(await port.answerStop(ID, 'raised', 9)).toEqual({ ok: true });
    expect(await port.setDailyCap(ID, 'night-shift', null)).toEqual({ ok: true });
    expect(sent).toEqual([
      { url: `/api/missions/${ID}/tokens`, body: { tokens: 5 } },
      { url: `/api/missions/stops/${ID}`, body: { answer: 'raised', tokens: 9 } },
      { url: '/api/virtual-fleets/tokens', body: { workspace: ID, fleet: 'night-shift', tokens: null } },
    ]);
  });

  it('sends a plain answer with no number, and the demo moves nothing', async () => {
    const { fetch, sent } = sentTo();
    await httpMissionsPort(fetch).answerStop(ID, 'stopped');
    expect(sent[0]?.body).toEqual({ answer: 'stopped' });
    for (const call of [demoMissionsPort.setBudget(ID, 1), demoMissionsPort.answerStop(ID, 'stopped'), demoMissionsPort.setDailyCap(ID, 'f', 1)]) expect(await call).toMatchObject({ ok: false });
  });
});
