// The runner's health call (PRD 2102, s1): `runnerApi().health()` on a fake fetch. It posts the report
// to the runner's own route with the sign-in, and names each failure the runner then prints.
import { describe, expect, it } from 'vitest';
import type { Tokens } from '../ask/schema.ts';
import { RunnerRefused, RunnerUnreachable, runnerApi } from './api.ts';
import type { HealthReport } from './api.ts';

const REPORT: HealthReport = { cpu: 63.5, load1: 7.9, cores: 8, memUsed: 13_958_643_712, memTotal: 17_179_869_184, diskFree: 41_875_931_136, diskTotal: 249_821_655_040 };

function api(answer: (init: RequestInit) => Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const held: Record<string, Tokens> = { 'omni.test': { access_token: 'access-1', refresh_token: 'refresh-1' } };
  const client = runnerApi({
    askUrl: 'https://omni.test/',
    tokens: { read: (host) => held[host] ?? null, write: (host, tokens) => { held[host] = tokens; } },
    fetch: (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return answer(init);
    },
  });
  return { client, calls };
}

const status = (code: number) => () => Promise.resolve(new Response(code === 204 ? null : '{}', { status: code }));

describe('runnerApi().health()', () => {
  it('posts the report to the runner\'s health route with the sign-in, within 5 s', async () => {
    const { client, calls } = api(status(200));
    await client.health('r 1', REPORT);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://omni.test/api/runners/r%201/health');
    expect(calls[0]?.init).toMatchObject({ method: 'POST', headers: { authorization: 'Bearer access-1', 'content-type': 'application/json' } });
    const body = calls[0]?.init.body;
    expect(typeof body === 'string' ? JSON.parse(body) : null).toEqual(REPORT);
  });

  it('names a route that is not there, another owner\'s runner and a malformed report as refusals', async () => {
    for (const [code, message] of [[404, 'refused (404)'], [403, 'refused (403)'], [400, 'refused (400)']] as const) {
      await expect(api(status(code)).client.health('r1', REPORT)).rejects.toThrow(new RunnerRefused(message));
    }
  });

  it('names a server error and a timeout as the app unreachable', async () => {
    await expect(api(status(503)).client.health('r1', REPORT)).rejects.toThrow(RunnerUnreachable);
    const timedOut = api(() => Promise.reject(Object.assign(new Error('aborted'), { name: 'TimeoutError' })));
    await expect(timedOut.client.health('r1', REPORT)).rejects.toThrow(new RunnerUnreachable('POST /api/runners/r1/health: timed out'));
  });
});
