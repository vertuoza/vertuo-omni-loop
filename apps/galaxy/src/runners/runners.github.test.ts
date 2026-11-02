import { createVerify, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { present } from '../ask/test/test-item';
import { APP_PERMISSIONS, type AppCredentials } from '../public-api/keys/github-app';
import { appJwt } from '../signup/github-app';
import { githubDeps } from './runners.github';
import type { JobRow } from './runners.repository';
import { runnersService } from './runners.service';
import { API_KEY, fakeStore, jobRow, KEY_APP, MO, OLGA, runnerRow, SHARED, T0, type KeyState } from './fixtures/store.fake';

vi.mock('server-only', () => ({}));

// The runners' GitHub wiring (PRD 2573 s1, over PRD 2433 s7): the real service over the App's own calls to GitHub
// (../public-api/keys/github-app.ts), on the store's fake and a stubbed GitHub behind an injected fetch. It proves the
// parts fit: the Omni App signs as itself, its bot is named by its slug once, and the token GitHub mints is asked for
// the job's repository alone, with the App's permissions and nothing more, whoever sent the job. The key and the token
// are made here, when the test runs: the repository holds none, not even a fake one (secret-shapes-guard).

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
const OMNI: AppCredentials = { appId: '424242', privateKey: PEM };
/** A key that holds its own App: its job runs as the Omni App all the same. */
const KEY: KeyState = { id: API_KEY, app: KEY_APP, working: true };
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
  'GET /app': json(200, { slug: 'omni-demo' }),
  'GET /users/omni-demo[bot]': json(200, { id: 4242 }),
  'GET /repos/demo-org/app/installation': installed(),
  'POST /app/installations/9001/access_tokens': json(201, { token: TOKEN, expires_at: EXPIRES }),
};
const BOT = { login: 'omni-demo[bot]', email: '4242+omni-demo[bot]@users.noreply.github.com' };

/** The real service, wired over `githubDeps(credentials)` on a stubbed GitHub, with `jobs` waiting for Olga's runner. */
function world({ credentials = OMNI, answers = HAPPY, jobs = [], slots = 1 }: {
  credentials?: AppCredentials | null; answers?: Record<string, () => Response | Promise<Response>>; jobs?: JobRow[]; slots?: number;
} = {}) {
  let now = T0;
  const { store, state } = fakeStore({ jobs, runners: [runnerRow({ id: SHARED, name: 'shared', slots, github_app: true })], keys: [KEY], now: () => now });
  const stub = github(answers);
  // A held `next` moves the clock as it sleeps, so it ends after its 40 s with no job.
  const clock = { now: () => now, sleep: (ms: number) => { now = new Date(now.getTime() + ms); return Promise.resolve(); } };
  const deps = githubDeps(credentials, stub.fetchImpl, () => NOW);
  return { service: runnersService(store, clock, deps), deps, state, calls: stub.calls, store, clock };
}

const keyJob = (more: Partial<JobRow> = {}) => jobRow({ sent_by: OLGA, sent_by_key: API_KEY, line: '/omni:bug-fix 2433', ...more });
const pageJob = (more: Partial<JobRow> = {}) => jobRow({ sent_by: MO, line: '/omni:yolo 2573', ...more });
const routes = (calls: Call[]) => calls.map((call) => `${call.method} ${call.path}`);

const value = <T>(served: { ok: true; value: T } | { ok: false; kind: string; error: string }): T => {
  if (!served.ok) throw new Error(`refused: ${served.kind} ${served.error}`);
  return served.value;
};

const signedByTheApp = (call: Call): boolean => {
  const jwt = present(call.headers.authorization, 'authorization').slice('Bearer '.length);
  const [head, body, sig] = jwt.split('.');
  return jwt === appJwt(OMNI, NOW)
    && createVerify('RSA-SHA256').update(`${head}.${body}`).verify(publicKey, Buffer.from(present(sig, 'signature'), 'base64url'));
};

describe('a job claimed over the Omni App\'s own calls', () => {
  it.each([['sent from the page', pageJob()], ['sent by a key that holds its own App', keyJob()]])(
    'names the bot, finds the installation and mints for a job %s, as the Omni App, with its permissions',
    async (_, job) => {
      const w = world({ jobs: [job] });
      expect(value(await w.service.next(OLGA, SHARED))).toMatchObject({ id: job.id, github: { token: TOKEN, expiresAt: EXPIRES, ...BOT } });
      expect(routes(w.calls)).toEqual(['GET /repos/demo-org/app/installation', 'POST /app/installations/9001/access_tokens', 'GET /app', 'GET /users/omni-demo[bot]']);
      expect(w.calls.filter((call) => call.path.startsWith('/app') || call.path.startsWith('/repos/')).every(signedByTheApp)).toBe(true);
      expect(present(w.calls[1], 'the mint call').body).toEqual({ repositories: ['app'], permissions: APP_PERMISSIONS });
    },
  );

  it('asks for the bot with no token, as GitHub refuses the App\'s there (#2528)', async () => {
    const w = world({ jobs: [pageJob()] });
    value(await w.service.next(OLGA, SHARED));
    expect(w.calls.find((call) => call.path === '/users/omni-demo[bot]')?.headers.authorization).toBeUndefined();
  });

  it('names the bot once for the wiring, across services and jobs', async () => {
    const w = world({ jobs: [pageJob({ queued_at: new Date(NOW - 60_000).toISOString() }), pageJob()], slots: 2 });
    value(await w.service.next(OLGA, SHARED));
    value(await runnersService(w.store, w.clock, w.deps).next(OLGA, SHARED));
    expect(routes(w.calls).filter((route) => route === 'GET /app' || route.startsWith('GET /users/'))).toEqual(['GET /app', 'GET /users/omni-demo[bot]']);
  });

  it('names the bot again after a read that failed', async () => {
    let first = true;
    const answers = { ...HAPPY, 'GET /users/omni-demo[bot]': () => (first ? (first = false, new Response('{}', { status: 403 })) : new Response(JSON.stringify({ id: 4242 }), { status: 200 })) };
    const w = world({ jobs: [pageJob({ queued_at: new Date(NOW - 60_000).toISOString() }), pageJob()], answers });
    expect(value(await w.service.next(OLGA, SHARED))).toMatchObject({ github: { ...BOT } });
    expect(w.state.jobs.map((job) => [job.status, job.reason])).toEqual([
      ['failed', 'github app: the App\'s bot could not be read: GitHub answered 403 to GET /users/omni-demo[bot]'],
      ['claimed', null],
    ]);
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
    expect(w.state.minted).toEqual([]);
  });

  it.each([
    ['a deployment without the Omni App', { credentials: null }, 'the Omni App is not configured on this server', 0],
    ['an App GitHub does not find on the repository', { answers: { ...HAPPY, 'GET /repos/demo-org/app/installation': json(404, {}) } }, 'the App is not installed on demo-org/app', 1],
    ['an installation without write access to issues', { answers: { ...HAPPY, 'GET /repos/demo-org/app/installation': installed('demo-org', { ...WRITE, issues: 'read' }) } }, 'the App\'s installation lacks write access to issues', 1],
    ['an installation of another account', { answers: { ...HAPPY, 'GET /repos/demo-org/app/installation': installed('other-org') } }, 'demo-org/app is not a repository of other-org', 1],
    ['a GitHub that fails the lookup', { answers: { ...HAPPY, 'GET /repos/demo-org/app/installation': json(502, {}) } }, 'GitHub answered 502 to GET /repos/demo-org/app/installation', 1],
    ['a GitHub that fails the mint', { answers: { ...HAPPY, 'POST /app/installations/9001/access_tokens': json(500, {}) } }, 'GitHub answered 500 to POST /app/installations/9001/access_tokens', 2],
    ['an App GitHub does not know', { answers: { ...HAPPY, 'GET /app': json(401, {}) } }, 'the App\'s bot could not be read: GitHub answered 401 to GET /app', 3],
    ['a bot GitHub does not name', { answers: { ...HAPPY, 'GET /users/omni-demo[bot]': json(404, {}) } }, 'the App\'s bot could not be read: GitHub answered 404 to GET /users/omni-demo[bot]', 4],
  ])('ends the job failed, `github app: <why>`, for %s, never answering it without the App', async (_, setup, why, asked) => {
    const job = pageJob();
    const w = world({ jobs: [job], ...setup });
    expect(value(await w.service.next(OLGA, SHARED))).toBeNull();
    expect(w.state.jobs[0]).toMatchObject({ status: 'failed', reason: `github app: ${why}` });
    expect(w.calls).toHaveLength(asked);
  });

  it('never says the private key or a token, in a reason or an answer', async () => {
    const failing = world({ jobs: [pageJob()], answers: { ...HAPPY, 'POST /app/installations/9001/access_tokens': json(500, { message: TOKEN }) } });
    value(await failing.service.next(OLGA, SHARED));
    const granted = world({ jobs: [pageJob()] });
    const answer = value(await granted.service.next(OLGA, SHARED));
    const said = JSON.stringify([failing.state.jobs[0]?.reason, { ...answer, github: { ...answer?.github, token: undefined } }]);
    for (const secret of [PEM.split('\n')[1] ?? PEM, TOKEN]) expect(said, secret).not.toContain(secret);
  });
});
