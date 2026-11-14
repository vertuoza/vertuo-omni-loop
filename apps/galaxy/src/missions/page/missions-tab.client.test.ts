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

  it('moves nothing in the demo', async () => {
    expect((await demoMissionsPort.move(ID, 'start')).ok).toBe(false);
  });
});
