// A resume's side of the runner's calls (PRD 2809, s5), on a fake fetch: `next` hands over a resume's attempt, chain and
// saves, read with the schema the app answers with, and a job with none, or one the runner cannot read, as none; a report
// the app refuses as ended (409) stops the job with the app's words, so the runner tells a loss from a cancel; and a
// portable save's bundle is downloaded through its signed link alone, with no sign-in.
import { describe, expect, it } from 'vitest';
import type { Tokens } from '../ask/schema.ts';
import { RunnerRefused, RunnerUnreachable, runnerApi } from './api.ts';
import type { CheckpointManifest } from './checkpoint.manifest.ts';

const JOB = '00000000-0000-4000-8000-000028095002';
const LOST = '00000000-0000-4000-8000-000028095001';

function api(answer: (url: string, init: RequestInit) => Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const held: Record<string, Tokens> = { 'omni.test': { access_token: 'access-1', refresh_token: 'refresh-1' } };
  const client = runnerApi({
    askUrl: 'https://omni.test/',
    tokens: { read: (host) => held[host] ?? null, write: (host, tokens) => { held[host] = tokens; } },
    fetch: (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return answer(url, init);
    },
  });
  return { client, calls };
}

const reply = (code: number, body: unknown) => () => Promise.resolve(new Response(JSON.stringify(body), { status: code }));

const MANIFEST: CheckpointManifest = {
  job: LOST, runner: 'box-1', repo: 'acme/widgets', kind: 'portable', savedAt: '2026-11-13T12:00:00.000Z', keepUntil: '2026-11-20T12:00:00.000Z', bundleBytes: 2048, bytes: 4096,
  branches: [{ branch: 'feat/x--s3', ref: 'refs/heads/omni-checkpoint/feat/x--s3', path: '.claude/worktrees/s3', base: 'a'.repeat(40), head: 'b'.repeat(40), files: 2, commits: 1 }],
  handoff: 'Next: the route.', failed: null,
};
const RESUME = {
  attempt: 2,
  chain: [LOST],
  saves: [{ job: LOST, kind: 'portable', manifest: MANIFEST, url: 'https://store.test/storage/v1/object/sign/runner-checkpoints/x.bundle?token=t', expiresAt: '2026-11-13T12:10:00.000Z' }],
};
const CLAIMED = { id: JOB, line: '/omni:wave 2809', repo: 'acme/widgets', sentBy: 'mo', allowedSkills: [], sentByKey: null, github: null };

describe('runnerApi().next(), a resume (PRD 2809, s5)', () => {
  it('hands over a resume\'s attempt, its chain and its saves', async () => {
    const job = await api(reply(200, { ...CLAIMED, resume: RESUME })).client.next('r1');
    expect(job?.resume).toEqual(RESUME);
  });

  it('reads a job with no resume, from an older app, as none', async () => {
    expect((await api(reply(200, CLAIMED)).client.next('r1'))?.resume).toBeNull();
  });

  it('reads a resume it cannot read as none, and still hands the job over', async () => {
    const job = await api(reply(200, { ...CLAIMED, resume: { ...RESUME, attempt: 7 } })).client.next('r1');
    expect(job).toMatchObject({ id: JOB, line: '/omni:wave 2809', resume: null });
  });
});

describe('runnerApi().update(), a job that ended on the app', () => {
  it('stops it on a 409, carrying the app\'s words', async () => {
    expect(await api(reply(409, { error: 'This job has ended: failed, runner lost. Stop it.' })).client.update(JOB, { status: 'running' }))
      .toEqual({ cancel: true, ended: 'This job has ended: failed, runner lost. Stop it.' });
    expect(await api(reply(409, {})).client.update(JOB, { status: 'running' })).toEqual({ cancel: true, ended: 'refused (409)' });
  });

  it('answers a cancel that waits, and none, with no words', async () => {
    expect(await api(reply(200, { cancel: true })).client.update(JOB, { status: 'running' })).toEqual({ cancel: true });
    expect(await api(reply(200, {})).client.update(JOB, { status: 'running' })).toEqual({ cancel: false });
  });
});

describe('runnerApi().checkpoints.download()', () => {
  it('gets the bundle at its signed link, with no sign-in, and answers its bytes', async () => {
    const { client, calls } = api(() => Promise.resolve(new Response(new Uint8Array([1, 2, 3]), { status: 200 })));
    expect(await client.checkpoints?.download('https://store.test/x.bundle?token=t')).toEqual(new Uint8Array([1, 2, 3]));
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://store.test/x.bundle?token=t');
    expect(calls[0]?.init.method).toBe('GET');
    expect(calls[0]?.init.headers).toBeUndefined();
  });

  it('names a refused link a refusal, and a storage out of reach unreachable', async () => {
    await expect(api(reply(400, {})).client.checkpoints?.download('https://store.test/x')).rejects.toThrow(new RunnerRefused('the storage refused the bundle (400)'));
    await expect(api(reply(503, {})).client.checkpoints?.download('https://store.test/x')).rejects.toThrow(new RunnerUnreachable('the storage answered 503'));
    await expect(api(() => Promise.reject(new Error('down'))).client.checkpoints?.download('https://store.test/x')).rejects.toThrow(new RunnerUnreachable('the storage is unreachable'));
  });
});
