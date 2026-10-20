// The runner's health call (PRD 2102, s1): `runnerApi().health()` on a fake fetch. It posts the report
// to the runner's own route with the sign-in, and names each failure the runner then prints.
import { describe, expect, it } from 'vitest';
import type { Tokens } from '../ask/schema.ts';
import { parsePrd } from '../ids.ts';
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

describe('runnerApi() terminal reads (PRD 2251)', () => {
  const body = (value: unknown) => () => Promise.resolve(new Response(JSON.stringify(value), { status: 200 }));
  const RUNNER = { id: 'r1', name: 'box-1', fleet: null, state: 'online', used: 1, slots: 4, repos: ['acme/widgets'] };

  it("reads the workspace's runners by repository, with the sign-in", async () => {
    const { client, calls } = api(body({ runners: [RUNNER] }));
    expect(await client.runners('acme/widgets')).toEqual([RUNNER]);
    expect(calls[0]?.url).toBe('https://omni.test/api/runners?repo=acme%2Fwidgets');
    expect(calls[0]?.init).toMatchObject({ method: 'GET', headers: { authorization: 'Bearer access-1' } });
  });

  it("reads a PRD's jobs and a job's lines after a number, an outcome missing reading as none", async () => {
    const job = { id: 'j1', line: '/omni:yolo 7', status: 'done', runner: 'box-1', prUrl: null, exitCode: 0, reason: null, queuedAt: 't' };
    const jobs = api(body({ jobs: [job] }));
    expect(await jobs.client.prdJobs('acme/widgets', parsePrd(7))).toEqual([{ ...job, outcome: null }]);
    expect(jobs.calls[0]?.url).toBe('https://omni.test/api/runners/jobs?repo=acme%2Fwidgets&prd=7');
    const lines = api(body({ status: 'running', lines: [{ seq: 4, text: 'x' }], more: false, first: 1, logTail: null }));
    expect(await lines.client.lines('j 1', 3)).toMatchObject({ status: 'running', lines: [{ seq: 4, text: 'x' }], more: false });
    expect(lines.calls[0]?.url).toBe('https://omni.test/api/runners/jobs/j%201/lines?after=3');
  });

  it('names a repository outside the workspace, an answer it cannot read and an unreachable app', async () => {
    await expect(api(status(403)).client.runners('a/b')).rejects.toThrow(new RunnerRefused('refused (403: this repository is not in your workspace)'));
    await expect(api(body({ nope: 1 })).client.prdJobs('a/b', parsePrd(1))).rejects.toThrow(RunnerRefused);
    await expect(api(status(503)).client.lines('j', 0)).rejects.toThrow(RunnerUnreachable);
  });

  it("sends a line to the jobs route and answers the job's id, or the app's refusal in its words", async () => {
    const sent = api(body({ job: { id: 'j9' } }));
    expect(await sent.client.send({ line: '/omni:yolo 7', repo: 'a/b', target: { kind: 'any' } })).toEqual({ id: 'j9' });
    expect(sent.calls[0]?.url).toBe('https://omni.test/api/runners/jobs');
    expect(sent.calls[0]?.init).toMatchObject({ method: 'POST' });
    const refused = api(() => Promise.resolve(new Response(JSON.stringify({ error: 'No runner takes that.' }), { status: 400 })));
    await expect(refused.client.send({ line: '/omni:yolo 7', repo: 'a/b', target: { kind: 'any' } })).rejects.toThrow(new RunnerRefused('No runner takes that.'));
  });
});
