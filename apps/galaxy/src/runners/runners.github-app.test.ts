import { describe, expect, it } from 'vitest';
import { GITHUB_TOKEN_AFTER_END_MS } from './runners.contract';
import type { JobRow, JobRowStatus, RunnerRow, RunnersRepository } from './runners.repository';
import { runnersService, type GithubDeps } from './runners.service';
import { BOT, EXPIRES, INSTALLATION, PRIVATE_KEY, stubGithub, TOKEN } from './fixtures/github.fake';
import { API_KEY, fakeStore, jobRow, KEY_APP, MO, OLGA, runnerRow, SHARED, T0, type KeyState } from './fixtures/store.fake';

// A key's job runs as the key's GitHub App (PRD 2433 s7), on the store's fake and a stubbed GitHub: the
// runner that registers `githubApp`, the claim that opens the key's sealed private key, finds the App's
// installation and mints a token for the job's repository, the job that fails when no token can be minted,
// and the refresh a runner asks for while the job runs and for 10 minutes after it ends. The App's own
// calls to GitHub are proven in ../public-api/keys/github-app.test.ts and the wiring over them in
// ./runners.github.test.ts; the stub is ./fixtures/github.fake.ts.

/** A runner of Olga's that registered `githubApp`, and one that did not. */
const APP_RUNNER = runnerRow({ id: SHARED, name: 'shared', slots: 1, github_app: true });
const PLAIN_RUNNER = runnerRow({ id: SHARED, name: 'shared', slots: 1, github_app: false });
const WORKS: KeyState = { id: API_KEY, app: KEY_APP, working: true };

/** The service on the fake store, a stubbed GitHub, and a clock the test moves. */
function world({ jobs = [], runners = [APP_RUNNER], keys = [WORKS], needsApp = [], github }: {
  jobs?: JobRow[]; runners?: RunnerRow[]; keys?: KeyState[]; needsApp?: string[]; github?: Partial<GithubDeps> | null;
} = {}) {
  let now = T0;
  const { store, state } = fakeStore({ jobs, runners, keys, needsApp, now: () => now });
  const stub = stubGithub(github ?? {});
  // A held `next` moves the clock as it sleeps, so it ends after its 40 s with no job.
  const clock = { now: () => now, sleep: (ms: number) => { now = new Date(now.getTime() + ms); return Promise.resolve(); } };
  const build = (repository: RunnersRepository) => runnersService(repository, clock, github === null ? null : stub.deps);
  return { service: build(store), build, store, state, asked: stub.asked, setNow: (next: Date) => { now = next; } };
}

const keyJob = (more: Partial<JobRow> = {}) => jobRow({ sent_by: OLGA, sent_by_key: API_KEY, line: '/omni:bug-fix 2433', ...more });
const held = (status: JobRowStatus, more: Partial<JobRow> = {}) => keyJob({
  status, runner_id: SHARED, claimed_at: T0.toISOString(), running_at: status === 'claimed' ? null : T0.toISOString(),
  ended_at: ['done', 'failed', 'cancelled'].includes(status) ? T0.toISOString() : null, ...more,
});

const value = <T>(served: { ok: true; value: T } | { ok: false; kind: string; error: string }): T => {
  if (!served.ok) throw new Error(`refused: ${served.kind} ${served.error}`);
  return served.value;
};

describe('a runner registering with the GitHub App (PRD 2433)', () => {
  const register = { name: 'nimbus-agents', slots: 2, repos: ['demo-org/app'], version: '0.0.530' };

  it('stores that it can run a job as an App, and false when it says nothing', async () => {
    const w = world({ runners: [] });
    value(await w.service.register(OLGA, { ...register, githubApp: true }));
    expect(w.state.runners[0]?.github_app).toBe(true);
    const other = world({ runners: [] });
    value(await other.service.register(OLGA, register));
    expect(other.state.runners[0]?.github_app).toBe(false);
  });

  it('stores it again, or false, each time the runner registers again', async () => {
    const w = world({ runners: [] });
    value(await w.service.register(OLGA, { ...register, githubApp: true }));
    value(await w.service.register(OLGA, { ...register, githubApp: false }));
    expect(w.state.runners.map((runner) => runner.github_app)).toEqual([false]);
    value(await w.service.register(OLGA, { ...register, githubApp: true }));
    value(await w.service.register(OLGA, register));
    expect(w.state.runners.map((runner) => runner.github_app)).toEqual([false]);
  });
});

describe('a key\'s job that runs as the key\'s App', () => {
  it('answers the job with the App\'s token, its expiry and its bot, and the key\'s name', async () => {
    const job = keyJob();
    const w = world({ jobs: [job] });
    expect(value(await w.service.next(OLGA, SHARED))).toEqual({
      id: job.id, line: '/omni:bug-fix 2433', repo: 'demo-org/app', sentBy: 'API key QA dashboard (@olga)', allowedSkills: [], sentByKey: 'QA dashboard',
      github: { token: TOKEN, expiresAt: EXPIRES, ...BOT },
    });
    expect(w.state.jobs[0]).toMatchObject({ status: 'claimed', runner_id: SHARED });
  });

  it('opens the key\'s sealed private key under the master key, and finds the installation on the job\'s repository', async () => {
    const w = world({ jobs: [keyJob()] });
    value(await w.service.next(OLGA, SHARED));
    expect(w.asked.opened).toEqual(['sealed-private-key/its-iv']);
    expect(w.asked.installations).toEqual(['demo-org/app']);
  });

  it('mints a token for the job\'s repository alone, with the App\'s id and key', async () => {
    const w = world({ jobs: [keyJob()] });
    value(await w.service.next(OLGA, SHARED));
    expect(w.asked.minted).toEqual([{ appId: '123456', privateKey: PRIVATE_KEY, installation: 9001, repositories: ['demo-org/app'] }]);
  });

  it('mints for a mega bug fix\'s plan repository alone: the repositories its product names are not added (outbox, s7)', async () => {
    const w = world({ jobs: [keyJob({ line: '/omni:mega-bug-fix #12', repo: 'demo-org/app' })] });
    value(await w.service.next(OLGA, SHARED));
    expect(w.asked.minted.map((minted) => minted.repositories)).toEqual([['demo-org/app']]);
  });

  it('records the mint for the key, once for each token', async () => {
    const w = world({ jobs: [keyJob()] });
    value(await w.service.next(OLGA, SHARED));
    expect(w.state.minted).toEqual([API_KEY]);
  });

  it('still answers the job when the mint cannot be recorded: the token exists, and the record is a label', async () => {
    const w = world({ jobs: [keyJob()] });
    const service = w.build({ ...w.store, appMinted: () => Promise.reject(new Error('the database is down')) });
    expect(value(await service.next(OLGA, SHARED))).toMatchObject({ github: { token: TOKEN } });
    expect(w.state.jobs[0]?.status).toBe('claimed');
  });

  it('fails a job queued while its key held an App once the App is removed, and never runs it as anyone else', async () => {
    const job = keyJob();
    const w = world({ jobs: [job], keys: [{ id: API_KEY, app: null, working: true }], needsApp: [job.id] });
    expect(value(await w.service.next(OLGA, SHARED))).toBeNull();
    expect(w.state.jobs[0]).toMatchObject({ status: 'failed', reason: 'github app: the GitHub App was removed from the API key' });
  });
});

describe('a job that runs as no App', () => {
  it('answers a key\'s job with no App as before, naming the key and asking GitHub for nothing', async () => {
    const job = keyJob();
    const w = world({ jobs: [job], keys: [] });
    expect(value(await w.service.next(OLGA, SHARED))).toEqual({
      id: job.id, line: '/omni:bug-fix 2433', repo: 'demo-org/app', sentBy: 'API key QA dashboard (@olga)', allowedSkills: [], sentByKey: 'QA dashboard', github: null,
    });
    expect(w.asked).toEqual({ opened: [], installations: [], minted: [] });
    expect(w.state.minted).toEqual([]);
  });

  it('answers a person\'s job with no key name and no App, even to a runner that holds one', async () => {
    const job = jobRow({ sent_by: MO });
    const w = world({ jobs: [job] });
    expect(value(await w.service.next(OLGA, SHARED))).toMatchObject({ id: job.id, sentBy: 'mo', sentByKey: null, github: null });
    expect(w.asked).toEqual({ opened: [], installations: [], minted: [] });
    expect(w.state.calls.filter((call) => call.startsWith('app of job'))).toEqual([]);
  });

  it('answers a key\'s job with no App to a runner that holds none, since nothing asks for one', async () => {
    const w = world({ jobs: [keyJob()], keys: [], runners: [PLAIN_RUNNER] });
    expect(value(await w.service.next(OLGA, SHARED))).toMatchObject({ sentByKey: 'QA dashboard', github: null });
  });
});

describe('a runner that did not register the App', () => {
  it('never takes a job that needs one, which waits queued, and takes the person\'s job behind it', async () => {
    const waiting = keyJob({ queued_at: new Date(T0.getTime() - 60_000).toISOString() });
    const person = jobRow({ sent_by: MO });
    const w = world({ jobs: [waiting, person], runners: [PLAIN_RUNNER] });
    expect(value(await w.service.next(OLGA, SHARED))).toMatchObject({ id: person.id, github: null });
    expect(w.state.jobs.find((job) => job.id === waiting.id)?.status).toBe('queued');
    expect(w.asked.minted).toEqual([]);
  });

  it('never takes a job queued while its key held an App, though the key holds none now', async () => {
    const job = keyJob();
    const w = world({ jobs: [job], keys: [], needsApp: [job.id], runners: [PLAIN_RUNNER] });
    expect(value(await w.service.next(OLGA, SHARED))).toBeNull();
    expect(w.state.jobs[0]?.status).toBe('queued');
  });
});

// The job is never answered without `github`, and never runs as a person: whatever stops a token ends it
// `failed`, `github app: <why>`, and the runner is handed the next job, if any.
describe('a job whose App cannot mint a token', () => {
  const GONE = 'github app: the API key no longer works: it was revoked, or its maker left the workspace';
  const cases: { name: string; world: Parameters<typeof world>[0]; reason: string }[] = [
    { name: 'a key revoked, or whose maker left the workspace', world: { keys: [{ id: API_KEY, app: KEY_APP, working: false }] }, reason: GONE },
    { name: 'an App removed from the key after the job was queued', world: { keys: [{ id: API_KEY, app: null, working: true }], needsApp: ['job'] }, reason: 'github app: the GitHub App was removed from the API key' },
    { name: 'a deployment with no master key', world: { github: { master: () => null } }, reason: 'github app: this Omni server has no key to open the App\'s private key' },
    { name: 'a deployment with no GitHub wiring at all', world: { github: null }, reason: 'github app: this Omni server has no key to open the App\'s private key' },
    { name: 'a private key that cannot be opened', world: { keys: [{ id: API_KEY, app: { ...KEY_APP, ciphertext: 'garbled' }, working: true }] }, reason: 'github app: the App\'s private key could not be opened' },
    { name: 'an App that is not installed on the repository', world: { github: { installation: () => Promise.resolve(null) } }, reason: 'github app: the App is not installed on demo-org/app' },
    {
      name: 'an installation without write access to contents',
      world: { github: { installation: () => Promise.resolve({ ...INSTALLATION, permissions: { ...INSTALLATION.permissions, contents: 'read' } }) } },
      reason: 'github app: the App\'s installation lacks write access to contents',
    },
    {
      name: 'a GitHub that fails the installation lookup',
      world: { github: { installation: () => Promise.reject(new Error('GitHub answered 502 to GET /repos/demo-org/app/installation')) } },
      reason: 'github app: GitHub answered 502 to GET /repos/demo-org/app/installation',
    },
    {
      name: 'a GitHub that refuses the token',
      world: { github: { mint: () => Promise.reject(new Error('GitHub answered 422 to POST /app/installations/9001/access_tokens')) } },
      reason: 'github app: GitHub answered 422 to POST /app/installations/9001/access_tokens',
    },
    {
      name: 'a repository that is not the installation\'s account\'s',
      world: { github: { mint: () => Promise.reject(new Error('demo-org/app is not a repository of acme')) } },
      reason: 'github app: demo-org/app is not a repository of acme',
    },
  ];

  it.each(cases)('ends the job failed, with the reason, for $name, and answers no job', async ({ world: setup, reason }) => {
    const job = keyJob();
    const w = world({ ...setup, jobs: [job], needsApp: setup?.needsApp ? [job.id] : [] });
    expect(value(await w.service.next(OLGA, SHARED))).toBeNull();
    expect(w.state.jobs[0]).toMatchObject({ status: 'failed', reason, runner_id: SHARED, ended_at: T0.toISOString() });
    expect(w.state.minted).toEqual([]);
  });

  it('hands the runner the next job at once, when the one it claimed could not mint', async () => {
    const failing = keyJob({ queued_at: new Date(T0.getTime() - 60_000).toISOString() });
    const person = jobRow({ sent_by: MO });
    const w = world({ jobs: [failing, person], keys: [{ id: API_KEY, app: KEY_APP, working: false }] });
    expect(value(await w.service.next(OLGA, SHARED))).toMatchObject({ id: person.id, github: null });
    expect(w.state.jobs.map((job) => [job.status, job.reason])).toEqual([['failed', GONE], ['claimed', null]]);
  });

  it('keeps the reason to its first line, and to 200 characters with its prefix', async () => {
    const lines = world({ jobs: [keyJob()], github: { mint: () => Promise.reject(new Error('GitHub answered 500 to POST /x\nsecond line')) } });
    value(await lines.service.next(OLGA, SHARED));
    expect(lines.state.jobs[0]?.reason).toBe('github app: GitHub answered 500 to POST /x');
    const long = world({ jobs: [keyJob()], github: { mint: () => Promise.reject(new Error('x'.repeat(500))) } });
    value(await long.service.next(OLGA, SHARED));
    expect(long.state.jobs[0]?.reason?.length).toBeLessThanOrEqual(200);
    expect(long.state.jobs[0]?.reason?.startsWith('github app: xxx')).toBe(true);
  });

  it('says nothing of the private key or the secret box\'s own words, in the reason or the answer', async () => {
    const w = world({ jobs: [keyJob()], keys: [{ id: API_KEY, app: { ...KEY_APP, ciphertext: 'garbled' }, working: true }] });
    const served = await w.service.next(OLGA, SHARED);
    const said = JSON.stringify([served, w.state.jobs]);
    for (const secret of [PRIVATE_KEY, 'Unsupported state', 'garbled', TOKEN, 'sealed-private-key']) expect(said, secret).not.toContain(secret);
  });
});

describe('a runner\'s refresh of a job\'s token', () => {
  const MIN = 60_000;

  it.each<JobRowStatus>(['claimed', 'running'])('answers a fresh token and its expiry to the job\'s runner while the job is %s', async (status) => {
    const job = held(status);
    const w = world({ jobs: [job] });
    expect(value(await w.service.githubToken(OLGA, job.id))).toEqual({ token: TOKEN, expiresAt: EXPIRES });
    expect(w.asked.minted).toEqual([{ appId: '123456', privateKey: PRIVATE_KEY, installation: 9001, repositories: ['demo-org/app'] }]);
  });

  it.each<JobRowStatus>(['done', 'failed', 'cancelled'])('answers until 10 minutes after the job ended %s, the minute itself included', async (status) => {
    const job = held(status);
    const w = world({ jobs: [job] });
    w.setNow(new Date(T0.getTime() + GITHUB_TOKEN_AFTER_END_MS));
    expect(value(await w.service.githubToken(OLGA, job.id))).toEqual({ token: TOKEN, expiresAt: EXPIRES });
  });

  it.each<JobRowStatus>(['done', 'failed', 'cancelled'])('refuses with a 409 after 10 minutes, for a job that ended %s, and asks GitHub for nothing', async (status) => {
    const job = held(status);
    const w = world({ jobs: [job] });
    w.setNow(new Date(T0.getTime() + GITHUB_TOKEN_AFTER_END_MS + 1_000));
    expect(await w.service.githubToken(OLGA, job.id)).toEqual({ ok: false, kind: 'conflict', error: 'This job ended over 10 minutes ago: it takes no new GitHub token.' });
    expect(w.asked).toEqual({ opened: [], installations: [], minted: [] });
    expect(w.state.minted).toEqual([]);
  });

  it('refuses a job that ended with no end time, rather than answering for ever', async () => {
    const job = held('done', { ended_at: null });
    const w = world({ jobs: [job] });
    expect(await w.service.githubToken(OLGA, job.id)).toMatchObject({ ok: false, kind: 'conflict' });
  });

  it('refuses another runner\'s owner with a 403, and asks GitHub for nothing', async () => {
    const job = held('running');
    const w = world({ jobs: [job] });
    expect(await w.service.githubToken(MO, job.id)).toEqual({ ok: false, kind: 'forbidden', error: 'This job was claimed by none of your runners.' });
    expect(w.asked).toEqual({ opened: [], installations: [], minted: [] });
  });

  it('refuses a job no runner claimed with a 403, and a job that does not exist with a 404', async () => {
    const queued = keyJob();
    const w = world({ jobs: [queued] });
    expect(await w.service.githubToken(OLGA, queued.id)).toMatchObject({ ok: false, kind: 'forbidden' });
    expect(await w.service.githubToken(OLGA, '00000000-0000-4000-8000-000000000000')).toEqual({ ok: false, kind: 'missing', error: 'No such job.' });
  });

  it('refuses a job that runs as no App with a 409: a person\'s, or a key\'s with none', async () => {
    const person = held('running', { sent_by: MO, sent_by_key: null });
    const noApp = held('running');
    const w = world({ jobs: [person, noApp], keys: [] });
    const words = { ok: false, kind: 'conflict', error: 'This job does not run as a GitHub App.' };
    expect(await w.service.githubToken(OLGA, person.id)).toEqual(words);
    expect(await w.service.githubToken(OLGA, noApp.id)).toEqual(words);
  });

  it('refuses with its words, a 409, when the key no longer works, so the runner can end the job on them', async () => {
    const job = held('running');
    const w = world({ jobs: [job], keys: [{ id: API_KEY, app: KEY_APP, working: false }] });
    expect(await w.service.githubToken(OLGA, job.id)).toEqual({ ok: false, kind: 'conflict', error: 'the API key no longer works: it was revoked, or its maker left the workspace' });
  });

  it('refuses with a 503 and its words when GitHub cannot be reached, for the runner to try again', async () => {
    const job = held('running');
    const w = world({ jobs: [job], github: { mint: () => Promise.reject(new Error('GitHub could not be reached (fetch failed)')) } });
    expect(await w.service.githubToken(OLGA, job.id)).toEqual({ ok: false, kind: 'unavailable', error: 'GitHub could not be reached (fetch failed)' });
  });

  it('mints a new token on each ask, and records each, without ending or changing the job', async () => {
    const job = held('running');
    const w = world({ jobs: [job] });
    value(await w.service.githubToken(OLGA, job.id));
    w.setNow(new Date(T0.getTime() + 55 * MIN));
    value(await w.service.githubToken(OLGA, job.id));
    expect(w.asked.minted).toHaveLength(2);
    expect(w.state.minted).toEqual([API_KEY, API_KEY]);
    expect(w.state.jobs[0]).toMatchObject({ status: 'running', reason: null });
  });
});
