// The runner's side of a job's save (PRD 2809, s4), `checkpointApi()` on a fake fetch: it asks the app for a signed
// upload link with its sign-in, sends the bundle to that link with no sign-in at all (the link is the permission),
// then records the manifest. A refusal carries the app's own words; a server error or a timeout is the app
// unreachable; a storage that refuses the bundle is a refusal naming its status.
import { describe, expect, it } from 'vitest';
import type { Tokens } from '../ask/schema.ts';
import { checkpointApi, RunnerRefused, RunnerUnreachable } from './api.ts';
import type { CheckpointManifest } from './checkpoint.manifest.ts';

const JOB = '00000000-0000-4000-8000-000000000a01';
const LINK = { path: `00000000-0000-4000-8000-0000000000f1/${JOB}/00000000-0000-4000-8000-0000000000b1.bundle`, url: 'https://store.test/storage/v1/object/upload/sign/runner-checkpoints/x?token=signed', expiresAt: '2027-01-20T12:00:00.000Z' };
const MANIFEST: CheckpointManifest = {
  job: JOB, runner: 'box-1', repo: 'acme/widgets', kind: 'portable', savedAt: '2027-01-20T10:00:00.000Z', keepUntil: '2027-01-27T10:00:00.000Z',
  bundleBytes: 4, bytes: 4096, branches: [{ branch: 'feat/x--s3', ref: 'refs/heads/omni-checkpoint/feat/x--s3', path: '.', base: null, head: 'a'.repeat(40), files: 1, commits: 0 }],
  handoff: null, failed: null,
};

type Call = { url: string; init: RequestInit };

function api(answer: (call: Call) => Promise<Response>) {
  const calls: Call[] = [];
  const held: Record<string, Tokens> = { 'omni.test': { access_token: 'access-1', refresh_token: 'refresh-1' } };
  const client = checkpointApi({
    askUrl: 'https://omni.test/',
    tokens: { read: (host) => held[host] ?? null, write: (host, tokens) => { held[host] = tokens; } },
    fetch: (url: string, init: RequestInit) => {
      const call = { url, init };
      calls.push(call);
      return answer(call);
    },
  });
  return { client, calls };
}

const reply = (code: number, body?: unknown) => () => Promise.resolve(new Response(body === undefined ? null : JSON.stringify(body), { status: code }));
const bodyOf = (call: Call | undefined): unknown => (typeof call?.init.body === 'string' ? JSON.parse(call.init.body) : null);

describe('checkpointApi().link()', () => {
  it('asks the job’s checkpoint route for a link, with the sign-in and the bundle’s size, and answers the link', async () => {
    const { client, calls } = api(reply(200, LINK));
    expect(await client.link('job 7', 2048)).toEqual(LINK);
    expect(calls[0]?.url).toBe('https://omni.test/api/runners/jobs/job%207/checkpoint');
    expect(calls[0]?.init).toMatchObject({ method: 'POST', headers: { authorization: 'Bearer access-1' } });
    expect(bodyOf(calls[0])).toEqual({ step: 'link', bytes: 2048 });
  });

  it('carries the app’s own words when it refuses, and refuses an answer with no link', async () => {
    await expect(api(reply(400, { error: 'This save is over 100 MB: keep it on the runner.' })).client.link(JOB, 1)).rejects.toThrow(new RunnerRefused('This save is over 100 MB: keep it on the runner.'));
    await expect(api(reply(403, { error: 'This job was claimed by none of your runners.' })).client.link(JOB, 1)).rejects.toThrow(new RunnerRefused('This job was claimed by none of your runners.'));
    await expect(api(reply(200, { path: LINK.path })).client.link(JOB, 1)).rejects.toThrow(new RunnerRefused('refused (the app answered no link)'));
    await expect(api(reply(200, { ...LINK, url: 'ftp://store.test/x' })).client.link(JOB, 1)).rejects.toThrow(new RunnerRefused('refused (the app answered no link)'));
  });

  it('names a server error as the app unreachable', async () => {
    await expect(api(reply(503, { error: 'down' })).client.link(JOB, 1)).rejects.toThrow(RunnerUnreachable);
  });
});

describe('checkpointApi().upload()', () => {
  it('puts the bundle to the signed link as bytes, with no sign-in, never replacing an object already there', async () => {
    const { client, calls } = api(reply(200, { Key: 'x' }));
    await client.upload(LINK, new Uint8Array([1, 2, 3, 4]));
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(LINK.url);
    expect(calls[0]?.init.method).toBe('PUT');
    expect(calls[0]?.init.headers).toEqual({ 'content-type': 'application/octet-stream', 'x-upsert': 'false' });
    expect(calls[0]?.init.body).toEqual(new Uint8Array([1, 2, 3, 4]));
  });

  it('names a storage that refuses the bundle as a refusal, and one that does not answer as unreachable', async () => {
    await expect(api(reply(413)).client.upload(LINK, new Uint8Array(1))).rejects.toThrow(new RunnerRefused('the storage refused the bundle (413)'));
    await expect(api(reply(502)).client.upload(LINK, new Uint8Array(1))).rejects.toThrow(new RunnerUnreachable('the storage answered 502'));
    await expect(api(() => Promise.reject(new TypeError('fetch failed'))).client.upload(LINK, new Uint8Array(1))).rejects.toThrow(new RunnerUnreachable('the storage is unreachable'));
  });
});

describe('checkpointApi().record()', () => {
  it('posts a portable save with its path and manifest, and a local one with its manifest alone', async () => {
    const recorded = { id: '00000000-0000-4000-8000-0000000000c1', kind: 'portable', keepUntil: '2027-01-27T10:00:00.000Z' };
    const { client, calls } = api(reply(200, recorded));
    expect(await client.record(JOB, { kind: 'portable', path: LINK.path, manifest: MANIFEST })).toEqual(recorded);
    expect(bodyOf(calls[0])).toEqual({ step: 'record', kind: 'portable', path: LINK.path, manifest: MANIFEST });
    const local = { ...MANIFEST, kind: 'local' as const, failed: 'the upload failed: the storage is unreachable' };
    await client.record(JOB, { kind: 'local', manifest: local });
    expect(bodyOf(calls[1])).toEqual({ step: 'record', kind: 'local', manifest: local });
  });

  it('carries the app’s own words when it refuses, and refuses an answer it cannot read', async () => {
    await expect(api(reply(409, { error: 'No bundle was uploaded at this path.' })).client.record(JOB, { kind: 'portable', path: LINK.path, manifest: MANIFEST }))
      .rejects.toThrow(new RunnerRefused('No bundle was uploaded at this path.'));
    await expect(api(reply(200, {})).client.record(JOB, { kind: 'local', manifest: { ...MANIFEST, kind: 'local' } })).rejects.toThrow(new RunnerRefused('refused (the app answered no save)'));
  });
});
