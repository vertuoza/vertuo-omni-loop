import { createVerify, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { present } from '../ask/test/test-item';
import { sealSecret } from '../jev/secret-box';
import { APP_PERMISSIONS } from '../public-api/keys/github-app';
import { appJwt } from '../signup/github-app';
import { githubDeps } from './runners.github';
import type { JobRow } from './runners.repository';
import { runnersService } from './runners.service';
import { API_KEY, fakeStore, jobRow, KEY_APP, OLGA, runnerRow, SHARED, T0, type KeyState } from './fixtures/store.fake';

vi.mock('server-only', () => ({}));

// The runners' GitHub wiring (PRD 2433 s7): the real service over the real secret box and the App's own
// calls to GitHub (../public-api/keys/github-app.ts), on the store's fake and a stubbed GitHub behind an
// injected fetch. It proves the parts fit: the sealed private key opens under the master key, the App
// signs as itself, and the token GitHub mints is asked for the job's repository alone, with the App's
// permissions and nothing more. The key, the master key and the token are made here, when the test runs:
// the repository holds none, not even a fake one (secret-shapes-guard).

const MASTER = Buffer.alloc(32, 9);
const RAW = MASTER.toString('base64');
const ANOTHER_RAW = Buffer.alloc(32, 4).toString('base64');
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
const SEALED = sealSecret(PEM, MASTER);
const KEY: KeyState = { id: API_KEY, app: { ...KEY_APP, ciphertext: SEALED.ciphertext, iv: SEALED.iv }, working: true };
const NOW = T0.getTime();
const TOKEN = 'gh' + 's_' + 'wired_token_for_the_tests';
const EXPIRES = '2026-10-13T13:00:00Z';
const WRITE = { contents: 'write', pull_requests: 'write', issues: 'write', metadata: 'read' };

type Call = { method: string; path: string; headers: Record<string, string>; body: unknown };

/** A stubbed GitHub: `METHOD /path` to the answer it gives; any other call is a 404. */
function github(answers: Record<string, () => Response | Promise<Response>>) {
  const calls: Call[] = [];
  const fetchImpl = (url: string, init: RequestInit): Promise<Response> => {
    const method = init.method ?? 'GET';
    const path = url.replace('https://api.github.com', '');
    calls.push({ method, path, headers: init.headers as Record<string, string>, body: typeof init.body === 'string' ? JSON.parse(init.body) as unknown : init.body });
    const answer = answers[`${method} ${path}`];
    return Promise.resolve(answer ? answer() : new Response('{}', { status: 404 }));
  };
  return { fetchImpl, calls };
}

const json = (status: number, body: unknown) => () => new Response(JSON.stringify(body), { status });
const installed = (account = 'demo-org', permissions: Record<string, string> = WRITE) => json(200, { id: 9001, account: { login: account }, permissions });
const HAPPY = {
  'GET /repos/demo-org/app/installation': installed(),
  'POST /app/installations/9001/access_tokens': json(201, { token: TOKEN, expires_at: EXPIRES }),
};

/** The real service, wired over `githubDeps(raw)` on a stubbed GitHub, with `jobs` waiting for Olga's runner. */
function world({ raw = RAW, answers = HAPPY, jobs = [] }: { raw?: string | null; answers?: Record<string, () => Response | Promise<Response>>; jobs?: JobRow[] } = {}) {
  let now = T0;
  const { store, state } = fakeStore({ jobs, runners: [runnerRow({ id: SHARED, name: 'shared', slots: 1, github_app: true })], keys: [KEY], now: () => now });
  const stub = github(answers);
  // A held `next` moves the clock as it sleeps, so it ends after its 40 s with no job.
  const clock = { now: () => now, sleep: (ms: number) => { now = new Date(now.getTime() + ms); return Promise.resolve(); } };
  const service = runnersService(store, clock, githubDeps(raw, stub.fetchImpl, () => NOW));
  return { service, state, calls: stub.calls };
}

const keyJob = (more: Partial<JobRow> = {}) => jobRow({ sent_by: OLGA, sent_by_key: API_KEY, line: '/omni:bug-fix 2433', ...more });

const value = <T>(served: { ok: true; value: T } | { ok: false; kind: string; error: string }): T => {
  if (!served.ok) throw new Error(`refused: ${served.kind} ${served.error}`);
  return served.value;
};

const signedByTheApp = (call: Call): boolean => {
  const jwt = present(call.headers.authorization, 'authorization').slice('Bearer '.length);
  const [head, body, sig] = jwt.split('.');
  return jwt === appJwt({ appId: '123456', privateKey: PEM }, NOW)
    && createVerify('RSA-SHA256').update(`${head}.${body}`).verify(publicKey, Buffer.from(present(sig, 'signature'), 'base64url'));
};

describe('the master key', () => {
  it('is the 32 bytes the setting holds, and none when it is unset or no key', () => {
    expect(githubDeps(RAW).master()).toEqual(MASTER);
    expect(githubDeps(null).master()).toBeNull();
    expect(githubDeps('not base64!').master()).toBeNull();
    expect(githubDeps(Buffer.alloc(16, 1).toString('base64')).master()).toBeNull();
  });
});

describe('a key\'s job claimed over the real secret box and the App\'s own calls', () => {
  it('opens the sealed key, finds the installation and mints for the job\'s repository alone with the App\'s permissions', async () => {
    const job = keyJob();
    const w = world({ jobs: [job] });
    expect(value(await w.service.next(OLGA, SHARED))).toMatchObject({
      id: job.id, sentByKey: 'QA dashboard',
      github: { token: TOKEN, expiresAt: EXPIRES, login: 'acme-bugs[bot]', email: '777+acme-bugs[bot]@users.noreply.github.com' },
    });
    expect(w.calls.map((call) => `${call.method} ${call.path}`)).toEqual(['GET /repos/demo-org/app/installation', 'POST /app/installations/9001/access_tokens']);
    expect(w.calls.every(signedByTheApp)).toBe(true);
    expect(present(w.calls[1], 'the mint call').body).toEqual({ repositories: ['app'], permissions: APP_PERMISSIONS });
    expect(w.state.minted).toEqual([API_KEY]);
  });

  it('asks GitHub again for each refresh, for the same repository, and answers the token and its expiry', async () => {
    const job = keyJob({ status: 'running', runner_id: SHARED, claimed_at: T0.toISOString(), running_at: T0.toISOString() });
    const w = world({ jobs: [job] });
    expect(value(await w.service.githubToken(OLGA, job.id))).toEqual({ token: TOKEN, expiresAt: EXPIRES });
    expect(value(await w.service.githubToken(OLGA, job.id))).toEqual({ token: TOKEN, expiresAt: EXPIRES });
    expect(w.calls.filter((call) => call.method === 'POST').map((call) => call.body)).toEqual([
      { repositories: ['app'], permissions: APP_PERMISSIONS },
      { repositories: ['app'], permissions: APP_PERMISSIONS },
    ]);
    expect(w.state.minted).toEqual([API_KEY, API_KEY]);
  });

  it.each([
    ['a master key that opens nothing', { raw: ANOTHER_RAW }, 'the App\'s private key could not be opened', 0],
    ['no master key', { raw: null }, 'this Omni server has no key to open the App\'s private key', 0],
    ['an App GitHub does not find on the repository', { answers: {} }, 'the App is not installed on demo-org/app', 1],
    ['an installation without write access to issues', { answers: { ...HAPPY, 'GET /repos/demo-org/app/installation': installed('demo-org', { ...WRITE, issues: 'read' }) } }, 'the App\'s installation lacks write access to issues', 1],
    ['an installation of another account', { answers: { ...HAPPY, 'GET /repos/demo-org/app/installation': installed('other-org') } }, 'demo-org/app is not a repository of other-org', 1],
    ['a GitHub that fails the lookup', { answers: { ...HAPPY, 'GET /repos/demo-org/app/installation': json(502, {}) } }, 'GitHub answered 502 to GET /repos/demo-org/app/installation', 1],
    ['a GitHub that fails the mint', { answers: { ...HAPPY, 'POST /app/installations/9001/access_tokens': json(500, {}) } }, 'GitHub answered 500 to POST /app/installations/9001/access_tokens', 2],
  ])('ends the job failed, `github app: <why>`, for %s, never answering it without the App', async (_, setup, why, asked) => {
    const job = keyJob();
    const w = world({ jobs: [job], ...setup });
    expect(value(await w.service.next(OLGA, SHARED))).toBeNull();
    expect(w.state.jobs[0]).toMatchObject({ status: 'failed', reason: `github app: ${why}` });
    expect(w.calls).toHaveLength(asked);
    expect(w.state.minted).toEqual([]);
  });

  it('never says the private key, the master key or a token, in a reason or an answer', async () => {
    const failing = world({ jobs: [keyJob()], answers: { ...HAPPY, 'POST /app/installations/9001/access_tokens': json(500, { message: TOKEN }) } });
    value(await failing.service.next(OLGA, SHARED));
    const granted = world({ jobs: [keyJob()] });
    const answer = value(await granted.service.next(OLGA, SHARED));
    const said = JSON.stringify([failing.state.jobs[0]?.reason, { ...answer, github: { ...answer?.github, token: undefined } }]);
    for (const secret of [PEM.split('\n')[1] ?? PEM, RAW, SEALED.ciphertext, TOKEN]) expect(said, secret).not.toContain(secret);
  });
});
