import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { askJudge, judgePath, signJudge } from './judge-client.ts';

const SECRET = 'stage-secret';
const PRD = parsePrd(1612);
const REPLY = { url: 'https://galaxy.test/prd/d-1', approval: null };

/** A fetch that records what it was handed and answers `respond`'s Response. */
function fetching(respond: () => Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch = (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return respond();
  };
  return { fetch, calls };
}

const json = (status: number, body: unknown) => () => Promise.resolve(new Response(JSON.stringify(body), { status }));

describe('askJudge — galaxy’s judge, signed by the App', () => {
  it('signs the path and query exactly as sent with STAGE_EVENT_SECRET, and reads the reply', async () => {
    const { fetch, calls } = fetching(json(200, REPLY));
    const answer = await askJudge('acme/widgets', PRD, { galaxyUrl: 'https://galaxy.test/', secret: SECRET, fetch });
    expect(answer).toEqual({ reply: REPLY });
    const [call] = calls;
    expect(call?.url).toBe('https://galaxy.test/api/approvals/judge?repo=acme/widgets&prd=1612');
    const signed = `sha256=${createHmac('sha256', SECRET).update('/api/approvals/judge?repo=acme/widgets&prd=1612').digest('hex')}`;
    expect(new Headers(call?.init.headers).get('x-omni-signature-256')).toBe(signed);
    expect(signJudge(SECRET, judgePath('acme/widgets', PRD))).toBe(signed);
  });

  it.each([401, 404, 500, 503])('a %i reads held', async (status) => {
    const { fetch } = fetching(json(status, { error: 'no' }));
    expect(await askJudge('acme/widgets', PRD, { galaxyUrl: 'https://galaxy.test', secret: SECRET, fetch })).toEqual({ held: `galaxy answered ${status}` });
  });

  it('a timeout or a network error reads held', async () => {
    const { fetch } = fetching(() => Promise.reject(new DOMException('The operation timed out.', 'TimeoutError')));
    expect(await askJudge('acme/widgets', PRD, { galaxyUrl: 'https://galaxy.test', secret: SECRET, fetch })).toEqual({ held: 'galaxy did not answer: The operation timed out.' });
  });

  it('an answer that is no approval reads held', async () => {
    const { fetch } = fetching(json(200, { hello: 'world' }));
    expect(await askJudge('acme/widgets', PRD, { galaxyUrl: 'https://galaxy.test', secret: SECRET, fetch })).toEqual({ held: 'galaxy answered no approval' });
    const notJson = fetching(() => Promise.resolve(new Response('<html>', { status: 200 })));
    expect(await askJudge('acme/widgets', PRD, { galaxyUrl: 'https://galaxy.test', secret: SECRET, fetch: notJson.fetch })).toEqual({ held: 'galaxy answered no JSON' });
  });

  it('with no secret on the App, asks nothing and holds', async () => {
    const { fetch, calls } = fetching(json(200, REPLY));
    expect(await askJudge('acme/widgets', PRD, { galaxyUrl: 'https://galaxy.test', secret: undefined, fetch })).toEqual({ held: 'STAGE_EVENT_SECRET is not set on the App' });
    expect(calls).toEqual([]);
  });

  it('refuses a repository that is no owner/name', () => {
    expect(() => judgePath('acme/widgets&prd=1', PRD)).toThrow(/not an owner\/name/);
  });
});
