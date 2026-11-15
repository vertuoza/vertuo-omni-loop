import { describe, expect, it } from 'vitest';
import type { Notifier, Ping } from './runners.contract';
import type { JobRow, JobRowStatus, QuestionsRow, RunnerRow, RunnersRepository } from './runners.repository';
import { runnersService, type GithubDeps } from './runners.service';
import { BOT, EXPIRES, INSTALLATION, KEY_APP_CREDENTIALS, KEY_BOT, KEY_PRIVATE_KEY, MASTER, OMNI_APP, PRIVATE_KEY, stubGithub, TOKEN } from './fixtures/github.fake';
import { API_KEY, fakeStore, jobRow, KEY_APP, MO, OLGA, OTHER_KEY, questionsRow, runnerRow, SHARED, T0, WORKSPACE, type KeyState } from './fixtures/store.fake';

// A job runs as the Omni GitHub App, or as its key's own App (PRD 2915 s1, over PRD 2573 s1 and PRD 2433 s7), on the store's
// fake and a stubbed GitHub: the claim finds the installation of the App the job runs as on the job's repository and mints a
// token for it, the key's App for a job whose key holds one or held one when the job was queued, the Omni App for every
// other job, from the page or by a key with no App; the job that fails when no token can be minted, never falling back
// from a key's App to the Omni App; and the refresh a runner asks for while the job runs, refused once it ended (PRD 2809, s3). The App's own calls to GitHub are
// proven in ../public-api/keys/github-app.test.ts and the wiring over them in ./runners.github.test.ts; the stub is
// ./fixtures/github.fake.ts. Which repositories a token covers beyond the job's own, and that it never reaches past
// a key's allow-list: ./runners.github-repositories.test.ts.

/** A runner of Olga's that registered `githubApp`, and one that did not. */
const APP_RUNNER = runnerRow({ id: SHARED, name: 'shared', slots: 1, github_app: true });
const PLAIN_RUNNER = runnerRow({ id: SHARED, name: 'shared', slots: 1, github_app: false });
const WORKS: KeyState = { id: API_KEY, app: KEY_APP, working: true };

/** The service on the fake store, a stubbed GitHub, and a clock the test moves. */
function world({ jobs = [], runners = [APP_RUNNER], keys = [WORKS], needsApp = [], questions = [], github, notifier }: {
  jobs?: JobRow[]; runners?: RunnerRow[]; keys?: KeyState[]; needsApp?: string[]; questions?: QuestionsRow[]; github?: Partial<GithubDeps> | null; notifier?: Notifier;
} = {}) {
  let now = T0;
  const { store, state, products } = fakeStore({ jobs, runners, keys, needsApp, questions, now: () => now });
  const stub = stubGithub(github ?? {});
  // A held `next` moves the clock as it sleeps, so it ends after its 40 s with no job.
  const clock = { now: () => now, sleep: (ms: number) => { now = new Date(now.getTime() + ms); return Promise.resolve(); } };
  const build = (repository: RunnersRepository) => runnersService(repository, clock, github === null ? null : stub.deps, notifier, products);
  return { service: build(store), build, store, state, asked: stub.asked, setNow: (next: Date) => { now = next; } };
}

const keyJob = (more: Partial<JobRow> = {}) => jobRow({ sent_by: OLGA, sent_by_key: API_KEY, line: '/omni:bug-fix 2433', ...more });
const personJob = (more: Partial<JobRow> = {}) => jobRow({ sent_by: MO, line: '/omni:yolo 2573', ...more });
const held = (status: JobRowStatus, more: Partial<JobRow> = {}) => keyJob({
  status, runner_id: SHARED, claimed_at: T0.toISOString(), running_at: status === 'claimed' ? null : T0.toISOString(),
  ended_at: ['done', 'failed', 'cancelled'].includes(status) ? T0.toISOString() : null, ...more,
});

/** What the stubbed GitHub was asked to mint: the Omni App's id and key, its installation, the job's repository. */
const OMNI_MINT = { appId: OMNI_APP.appId, privateKey: PRIVATE_KEY, installation: 9001, repositories: ['demo-org/app'] };
/** What it was asked to mint for a job of `KEY_APP`: the key's App's id and its private key, opened. */
const KEY_MINT = { appId: KEY_APP_CREDENTIALS.appId, privateKey: KEY_PRIVATE_KEY, installation: 9001, repositories: ['demo-org/app'] };
/** A job a person sent from the page: it runs as the Omni App. */
const PAGE = { sent_by: MO, sent_by_key: null } as const;

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

describe('a job sent from the page runs as the Omni App', () => {
  it('is answered with a token minted on the Omni App\'s installation for its repository, and the App\'s bot', async () => {
    const job = personJob();
    const w = world({ jobs: [job], keys: [] });
    expect(value(await w.service.next(OLGA, SHARED))).toEqual({
      id: job.id, line: '/omni:yolo 2573', repo: 'demo-org/app', sentBy: 'mo', allowedSkills: [], sentByKey: null,
      github: { token: TOKEN, expiresAt: EXPIRES, ...BOT },
    });
    expect(w.asked.installations).toEqual(['demo-org/app']);
    expect(w.asked.minted).toEqual([OMNI_MINT]);
    expect(w.state.jobs[0]).toMatchObject({ status: 'claimed', runner_id: SHARED });
  });

  it('reads no key for it', async () => {
    const w = world({ jobs: [personJob()], keys: [] });
    value(await w.service.next(OLGA, SHARED));
    expect(w.state.calls.filter((call) => call.startsWith('app of job'))).toEqual([]);
  });

  it('runs a job the Omni app sent as the Omni App too', async () => {
    const job = jobRow({ sent_by: null, sent_by_app: 'omni-app', line: '/omni:yolo 2573' });
    const w = world({ jobs: [job], keys: [] });
    expect(value(await w.service.next(OLGA, SHARED))).toMatchObject({ id: job.id, sentBy: 'Omni app', github: { token: TOKEN, ...BOT } });
  });

  it('mints a mega bug fix in no product for its plan repository alone (its product\'s repositories: runners.github-repositories.test.ts)', async () => {
    const w = world({ jobs: [personJob({ line: '/omni:mega-bug-fix #12' })], keys: [] });
    value(await w.service.next(OLGA, SHARED));
    expect(w.asked.minted.map((minted) => minted.repositories)).toEqual([['demo-org/app']]);
  });
});

describe('a job an API key sent runs as the key\'s own App when the key holds one', () => {
  it('is answered with a token minted on the key\'s App\'s installation, and the key\'s App\'s bot, read from its stored row', async () => {
    const job = keyJob();
    const w = world({ jobs: [job] });
    expect(value(await w.service.next(OLGA, SHARED))).toEqual({
      id: job.id, line: '/omni:bug-fix 2433', repo: 'demo-org/app', sentBy: 'API key QA dashboard (@olga)', allowedSkills: [], sentByKey: 'QA dashboard',
      github: { token: TOKEN, expiresAt: EXPIRES, ...KEY_BOT },
    });
    expect(w.asked.bots).toBe(0);
    expect(w.state.jobs[0]).toMatchObject({ status: 'claimed', runner_id: SHARED });
  });

  it('mints with the key\'s App\'s id and its opened private key, never the Omni App\'s', async () => {
    const w = world({ jobs: [keyJob()] });
    value(await w.service.next(OLGA, SHARED));
    expect(w.asked.minted).toEqual([KEY_MINT]);
    expect(w.asked.minted.map((minted) => minted.appId)).not.toContain(OMNI_APP.appId);
  });

  it('opens the sealed key it stored, under the master key, and nothing else', async () => {
    const opened: unknown[] = [];
    const open: GithubDeps['open'] = (sealed, master) => {
      opened.push([sealed, master.equals(MASTER)]);
      return KEY_PRIVATE_KEY;
    };
    const w = world({ jobs: [keyJob()], github: { open } });
    value(await w.service.next(OLGA, SHARED));
    expect(opened).toEqual([[KEY_APP, true]]);
  });

  it('records the mint for the key\'s last token, and answers the job though the record fails', async () => {
    const w = world({ jobs: [keyJob()] });
    value(await w.service.next(OLGA, SHARED));
    expect(w.state.minted).toEqual([API_KEY]);

    const job = keyJob();
    const failing = world({ jobs: [job] });
    const broken = failing.build({ ...failing.store, appMinted: () => Promise.reject(new Error('api_key_github_app_minted(): connection reset')) });
    expect(value(await broken.next(OLGA, SHARED))).toMatchObject({ id: job.id, github: { token: TOKEN, ...KEY_BOT } });
  });

  it('never says the private key or the sealed key in the answer', async () => {
    const w = world({ jobs: [keyJob()] });
    const said = JSON.stringify([await w.service.next(OLGA, SHARED), w.state.jobs]);
    for (const secret of [KEY_PRIVATE_KEY, KEY_APP.ciphertext, KEY_APP.iv, PRIVATE_KEY]) expect(said, secret).not.toContain(secret);
  });

  it('runs as the key\'s App a job queued while its key held one, once the key holds it again', async () => {
    const job = keyJob();
    const w = world({ jobs: [job], keys: [WORKS], needsApp: [job.id] });
    expect(value(await w.service.next(OLGA, SHARED))).toMatchObject({ id: job.id, github: { token: TOKEN, ...KEY_BOT } });
  });
});

describe('a job an API key sent runs as the Omni App when its key holds no App', () => {
  it('is answered with the Omni App\'s token and bot, and the key\'s name, whether the key is known with no App or not', async () => {
    const job = keyJob();
    const none = world({ jobs: [job], keys: [{ id: API_KEY, app: null, working: true }] });
    expect(value(await none.service.next(OLGA, SHARED))).toEqual({
      id: job.id, line: '/omni:bug-fix 2433', repo: 'demo-org/app', sentBy: 'API key QA dashboard (@olga)', allowedSkills: [], sentByKey: 'QA dashboard',
      github: { token: TOKEN, expiresAt: EXPIRES, ...BOT },
    });
    expect(none.asked.minted).toEqual([OMNI_MINT]);
    const unknown = world({ jobs: [keyJob()], keys: [] });
    expect(value(await unknown.service.next(OLGA, SHARED))).toMatchObject({ sentByKey: 'QA dashboard', github: { token: TOKEN, ...BOT } });
  });

  it('records no token for the key, and opens no key', async () => {
    const opened: unknown[] = [];
    const w = world({ jobs: [keyJob()], keys: [{ id: API_KEY, app: null, working: true }], github: { open: (sealed) => { opened.push(sealed); return KEY_PRIVATE_KEY; } } });
    value(await w.service.next(OLGA, SHARED));
    expect(w.state.minted).toEqual([]);
    expect(opened).toEqual([]);
  });

  it('never says a key\'s App\'s slug, bot or sealed key in the answer', async () => {
    const w = world({ jobs: [keyJob()], keys: [{ id: API_KEY, app: null, working: true }] });
    const said = JSON.stringify(await w.service.next(OLGA, SHARED));
    for (const word of [KEY_APP.slug, String(KEY_APP.bot_id), KEY_APP.ciphertext]) expect(said, word).not.toContain(word);
  });
});

describe('the Omni App\'s bot', () => {
  it('is read once for each service, however many jobs it answers', async () => {
    const w = world({ jobs: [personJob({ queued_at: new Date(T0.getTime() - 60_000).toISOString() }), personJob()], runners: [runnerRow({ id: SHARED, name: 'shared', slots: 2, github_app: true })], keys: [] });
    value(await w.service.next(OLGA, SHARED));
    value(await w.service.next(OLGA, SHARED));
    expect(w.asked.minted).toHaveLength(2);
    expect(w.asked.bots).toBe(1);
  });

  it('is read again after a read that failed', async () => {
    let tries = 0;
    const bot: GithubDeps['bot'] = () => {
      tries += 1;
      return tries === 1 ? Promise.reject(new Error('GitHub answered 502 to GET /app')) : Promise.resolve({ slug: 'omni-demo', botId: 4242 });
    };
    const w = world({ jobs: [personJob({ queued_at: new Date(T0.getTime() - 60_000).toISOString() }), personJob()], keys: [], github: { bot } });
    expect(value(await w.service.next(OLGA, SHARED))).toMatchObject({ github: { ...BOT } });
    expect(w.state.jobs.map((job) => job.status)).toEqual(['failed', 'claimed']);
    expect(tries).toBe(2);
  });

  it('is not read for a refresh, which carries the token alone', async () => {
    const job = held('running');
    const w = world({ jobs: [job] });
    value(await w.service.githubToken(OLGA, job.id));
    expect(w.asked.bots).toBe(0);
  });
});

describe('what the runner did not register', () => {
  it('takes no job at all, a key\'s or a person\'s, and both wait queued (PRD 2573)', async () => {
    const waiting = keyJob({ queued_at: new Date(T0.getTime() - 60_000).toISOString() });
    const person = personJob();
    const w = world({ jobs: [waiting, person], runners: [PLAIN_RUNNER] });
    expect(value(await w.service.next(OLGA, SHARED))).toBeNull();
    expect(w.state.jobs.map((job) => job.status)).toEqual(['queued', 'queued']);
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
describe('a job the Omni App cannot mint a token for', () => {
  const GONE = 'github app: the API key no longer works: it was revoked, or its maker left the workspace';
  const NOT_CONFIGURED = 'github app: the Omni App is not configured on this server';
  const REMOVED = 'github app: the key\'s App was removed';
  const NO_KEY = 'github app: this Omni server has no key to open the App\'s private key';
  const cases: { name: string; job?: Partial<JobRow>; world: Parameters<typeof world>[0]; reason: string }[] = [
    { name: 'a deployment without GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY, for a job of a key with no App', job: { sent_by_key: API_KEY }, world: { keys: [{ id: API_KEY, app: null, working: true }], github: { credentials: null } }, reason: NOT_CONFIGURED },
    { name: 'a page job on a deployment with no GitHub wiring at all', job: PAGE, world: { github: null }, reason: NOT_CONFIGURED },
    { name: 'a page job on a deployment without the App', job: PAGE, world: { github: { credentials: null } }, reason: NOT_CONFIGURED },
    { name: 'an App that is not installed on the repository', world: { github: { installation: () => Promise.resolve(null) } }, reason: 'github app: the App is not installed on demo-org/app' },
    {
      name: 'an installation without write access to contents',
      world: { github: { installation: () => Promise.resolve({ ...INSTALLATION, permissions: { ...INSTALLATION.permissions, contents: 'read' } }) } },
      reason: 'github app: the App\'s installation lacks write access to contents',
    },
    {
      name: 'an installation without write access to pull requests',
      job: { sent_by: MO, sent_by_key: null },
      world: { github: { installation: () => Promise.resolve({ ...INSTALLATION, permissions: { ...INSTALLATION.permissions, pull_requests: 'read' } }) } },
      reason: 'github app: the App\'s installation lacks write access to pull_requests',
    },
    {
      name: 'a bot GitHub does not name',
      job: PAGE,
      world: { github: { bot: () => Promise.reject(new Error('GitHub answered 404 to GET /users/omni-demo[bot]')) } },
      reason: 'github app: the App\'s bot could not be read: GitHub answered 404 to GET /users/omni-demo[bot]',
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
    { name: 'a deployment with no master key', world: { github: { master: () => null } }, reason: NO_KEY },
    { name: 'a deployment with no GitHub wiring at all, for a job of a key\'s App', world: { github: null }, reason: NO_KEY },
    { name: 'a sealed key that cannot be opened', world: { github: { open: () => { throw new Error('The stored secret could not be opened with this master key.'); } } }, reason: 'github app: the App\'s private key could not be opened' },
    { name: 'a key revoked, or whose maker left the workspace', world: { keys: [{ id: API_KEY, app: KEY_APP, working: false }] }, reason: GONE },
    { name: 'a key with no App that no longer works', world: { keys: [{ id: API_KEY, app: null, working: false }] }, reason: GONE },
  ];

  it.each(cases)('ends the job failed, with the reason, for $name, and answers no job', async ({ job: more, world: setup, reason }) => {
    const job = keyJob(more);
    const w = world({ ...setup, jobs: [job] });
    expect(value(await w.service.next(OLGA, SHARED))).toBeNull();
    expect(w.state.jobs[0]).toMatchObject({ status: 'failed', reason, runner_id: SHARED, ended_at: T0.toISOString() });
  });

  it('ends a job queued while its key held an App, the App removed since, and asks GitHub for nothing', async () => {
    const job = keyJob();
    const w = world({ jobs: [job], keys: [{ id: API_KEY, app: null, working: true }], needsApp: [job.id] });
    expect(value(await w.service.next(OLGA, SHARED))).toBeNull();
    expect(w.state.jobs[0]).toMatchObject({ status: 'failed', reason: REMOVED, runner_id: SHARED });
    expect(w.asked).toEqual({ bots: 0, installations: [], minted: [] });
    expect(w.state.minted).toEqual([]);
  });

  it('never falls back to the Omni App when the key\'s App cannot mint', async () => {
    const w = world({ jobs: [keyJob()], github: { installation: () => Promise.resolve(null) } });
    expect(value(await w.service.next(OLGA, SHARED))).toBeNull();
    expect(w.asked.minted).toEqual([]);
    expect(w.state.minted).toEqual([]);
  });

  it('asks GitHub for nothing for a key that no longer works', async () => {
    const w = world({ jobs: [keyJob()], keys: [{ id: API_KEY, app: KEY_APP, working: false }] });
    value(await w.service.next(OLGA, SHARED));
    expect(w.asked).toEqual({ bots: 0, installations: [], minted: [] });
  });

  it('hands the runner the next job at once, when the one it claimed could not mint', async () => {
    const failing = keyJob({ queued_at: new Date(T0.getTime() - 60_000).toISOString() });
    const person = personJob();
    const w = world({ jobs: [failing, person], keys: [{ id: API_KEY, app: KEY_APP, working: false }] });
    expect(value(await w.service.next(OLGA, SHARED))).toMatchObject({ id: person.id, github: { token: TOKEN } });
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

  it('says nothing of the private key or a token, in the reason or the answer', async () => {
    const w = world({ jobs: [personJob()], github: { bot: () => Promise.reject(new Error(`GitHub answered 401 to GET /app\n${PRIVATE_KEY}`)) } });
    const served = await w.service.next(OLGA, SHARED);
    const said = JSON.stringify([served, w.state.jobs]);
    for (const secret of [PRIVATE_KEY, TOKEN, KEY_APP.ciphertext]) expect(said, secret).not.toContain(secret);
  });

  it('says nothing of a key\'s App\'s opened or sealed private key, when it cannot be opened or GitHub refuses its token', async () => {
    const box = world({ jobs: [keyJob()], github: { open: () => { throw new Error(`cipher failure ${KEY_PRIVATE_KEY} ${KEY_APP.ciphertext}`); } } });
    const refused = world({ jobs: [keyJob()], github: { mint: () => Promise.reject(new Error(`GitHub answered 401 to POST /app/installations/9001/access_tokens\n${KEY_PRIVATE_KEY}`)) } });
    for (const w of [box, refused]) {
      const said = JSON.stringify([await w.service.next(OLGA, SHARED), w.state.jobs]);
      for (const secret of [KEY_PRIVATE_KEY, KEY_APP.ciphertext, KEY_APP.iv, TOKEN]) expect(said, secret).not.toContain(secret);
    }
  });
});

describe('a runner\'s refresh of a job\'s token', () => {
  const MIN = 60_000;

  it.each<JobRowStatus>(['claimed', 'running'])('answers a fresh token of the key\'s App and its expiry to the job\'s runner while the job is %s', async (status) => {
    const job = held(status);
    const w = world({ jobs: [job] });
    expect(value(await w.service.githubToken(OLGA, job.id))).toEqual({ token: TOKEN, expiresAt: EXPIRES });
    expect(w.asked.minted).toEqual([KEY_MINT]);
    expect(w.state.minted).toEqual([API_KEY]);
  });

  it('answers a fresh Omni App token to the runner of a key\'s job whose key holds no App', async () => {
    const job = held('running');
    const w = world({ jobs: [job], keys: [{ id: API_KEY, app: null, working: true }] });
    expect(value(await w.service.githubToken(OLGA, job.id))).toEqual({ token: TOKEN, expiresAt: EXPIRES });
    expect(w.asked.minted).toEqual([OMNI_MINT]);
    expect(w.state.minted).toEqual([]);
  });

  it('answers a page job\'s runner with the Omni App\'s token', async () => {
    const job = held('running', PAGE);
    const w = world({ jobs: [job], keys: [] });
    expect(value(await w.service.githubToken(OLGA, job.id))).toEqual({ token: TOKEN, expiresAt: EXPIRES });
    expect(w.asked.minted).toEqual([OMNI_MINT]);
  });

  it('refuses with a 409 and its words when the key\'s App was removed, or this server cannot open its key', async () => {
    const job = held('running');
    const removed = world({ jobs: [job], keys: [{ id: API_KEY, app: null, working: true }], needsApp: [job.id] });
    expect(await removed.service.githubToken(OLGA, job.id)).toEqual({ ok: false, kind: 'conflict', error: 'the key\'s App was removed' });
    const keyless = world({ jobs: [job], github: { master: () => null } });
    expect(await keyless.service.githubToken(OLGA, job.id)).toEqual({ ok: false, kind: 'conflict', error: 'this Omni server has no key to open the App\'s private key' });
    expect(removed.asked.minted).toEqual([]);
    expect(keyless.asked.minted).toEqual([]);
  });

  // The fence (PRD 2809, s3): a job that ended takes no new token, from the moment it ended, so a replaced attempt
  // keeps only the token it holds, which runs out within the hour it was minted.
  it.each<JobRowStatus>(['done', 'failed', 'cancelled'])('refuses with a 409 the moment the job ended %s, and asks GitHub for nothing', async (status) => {
    const job = held(status);
    const w = world({ jobs: [job] });
    expect(await w.service.githubToken(OLGA, job.id)).toEqual({ ok: false, kind: 'conflict', error: 'This job has ended: it takes no new GitHub token.' });
    expect(w.asked).toEqual({ bots: 0, installations: [], minted: [] });
  });

  it('refuses the runner of a job the app marked lost, whose resume may be running elsewhere', async () => {
    const job = held('failed', { reason: 'runner lost' });
    const w = world({ jobs: [job] });
    w.setNow(new Date(T0.getTime() + MIN));
    expect(await w.service.githubToken(OLGA, job.id)).toEqual({ ok: false, kind: 'conflict', error: 'This job has ended: it takes no new GitHub token.' });
    expect(w.asked.minted).toEqual([]);
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
    expect(w.asked).toEqual({ bots: 0, installations: [], minted: [] });
  });

  it('refuses a job no runner claimed with a 403, and a job that does not exist with a 404', async () => {
    const queued = keyJob();
    const w = world({ jobs: [queued] });
    expect(await w.service.githubToken(OLGA, queued.id)).toMatchObject({ ok: false, kind: 'forbidden' });
    expect(await w.service.githubToken(OLGA, '00000000-0000-4000-8000-000000000000')).toEqual({ ok: false, kind: 'missing', error: 'No such job.' });
  });

  it('refuses with a 409 and its words on a deployment without the Omni App', async () => {
    const job = held('running', PAGE);
    const w = world({ jobs: [job], keys: [], github: { credentials: null } });
    expect(await w.service.githubToken(OLGA, job.id)).toEqual({ ok: false, kind: 'conflict', error: 'the Omni App is not configured on this server' });
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

  it('mints a new token on each ask, without ending or changing the job', async () => {
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

// What a key's job carries on is the key's too (PRD 2425). The database marks every insert of a key's job that finds
// the key holding an App (runner_job_needs_app_mark()), a resume, a relaunch and a continuation included, so the job waits
// for a runner that registered the App; once claimed, it runs as the key's App (PRD 2915), or as the Omni App when the key holds none.
describe('a job that carries a key\'s job on runs as the key\'s App (PRD 2425, PRD 2915)', () => {
  const ANSWERS = { 'Which fix?': 'Guard the input' };
  /** Another key of the workspace, which answers and relaunches. */
  const OTHER = { id: OTHER_KEY, workspace: WORKSPACE, actingFor: null };
  const ended = (more: Partial<JobRow> = {}) => held('done', { exit_code: 0, line: '/omni:bug-fix #314', ...more });
  /** A key's bug fix that ended with its questions open. */
  const waiting = (runners: RunnerRow[]) => {
    const job = ended({ outcome: 'human' });
    return { job, w: world({ jobs: [job], runners, questions: [questionsRow({ job_id: job.id })] }) };
  };
  const failed = (runners: RunnerRow[], more: Partial<JobRow> = {}) => {
    const job = ended({ status: 'failed', exit_code: 1, ...more });
    return { job, w: world({ jobs: [job], runners }) };
  };

  it('marks the resume of an answer by a key, which no runner that cannot run as the App takes, and the App\'s runner takes with a token', async () => {
    const { job, w: plain } = waiting([PLAIN_RUNNER]);
    const resume = value(await plain.service.answerByKey(OTHER, job.id, ANSWERS));
    expect(plain.state.jobs.find((row) => row.id === resume.id)).toMatchObject({ sent_by_key: API_KEY, continues: job.id });
    expect(plain.state.needsApp.has(resume.id)).toBe(true);
    expect(value(await plain.service.next(OLGA, SHARED))).toBeNull();
    expect(plain.state.jobs.find((row) => row.id === resume.id)?.status).toBe('queued');

    const { job: first, w: app } = waiting([APP_RUNNER]);
    const queued = value(await app.service.answerByKey(OTHER, first.id, ANSWERS));
    expect(value(await app.service.next(OLGA, SHARED))).toMatchObject({
      id: queued.id, line: `/omni:bug-fix #314 --answers ${first.id}`, sentByKey: 'QA dashboard', github: { token: TOKEN, expiresAt: EXPIRES, ...KEY_BOT },
    });
  });

  it('marks the resume of an answer a person gives on the Runners page, the thread staying the key\'s', async () => {
    const { job, w } = waiting([PLAIN_RUNNER]);
    const resume = value(await w.service.answer(OLGA, job.id, { answers: ANSWERS }));
    expect(w.state.jobs.find((row) => row.id === resume.id)).toMatchObject({ sent_by_key: API_KEY, continues: job.id });
    expect(w.state.needsApp.has(resume.id)).toBe(true);
    expect(value(await w.service.next(OLGA, SHARED))).toBeNull();
  });

  it('marks the relaunch of a failed job, which keeps the key and its link, and waits for a runner that can run it as the App', async () => {
    const { job, w } = failed([PLAIN_RUNNER], { notify_url: 'https://hooks.example.com/omni' });
    const again = value(await w.service.relaunchByKey(OTHER, job.id));
    expect(w.state.jobs.find((row) => row.id === again.id)).toMatchObject({ sent_by_key: API_KEY, continues: job.id, notify_url: 'https://hooks.example.com/omni' });
    expect(w.state.needsApp.has(again.id)).toBe(true);
    expect(value(await w.service.next(OLGA, SHARED))).toBeNull();

    const { job: first, w: app } = failed([APP_RUNNER]);
    const queued = value(await app.service.relaunchByKey(OTHER, first.id));
    expect(value(await app.service.next(OLGA, SHARED))).toMatchObject({ id: queued.id, sentByKey: 'QA dashboard', github: { token: TOKEN, ...KEY_BOT } });
  });

  it('marks none when the key holds no App when the resume is queued, and the resume runs as the Omni App', async () => {
    const job = ended({ outcome: 'human' });
    const w = world({ jobs: [job], keys: [{ id: API_KEY, app: null, working: true }], runners: [APP_RUNNER], questions: [questionsRow({ job_id: job.id })] });
    const resume = value(await w.service.answerByKey(OTHER, job.id, ANSWERS));
    expect(w.state.needsApp.has(resume.id)).toBe(false);
    expect(value(await w.service.next(OLGA, SHARED))).toMatchObject({ id: resume.id, github: { token: TOKEN, ...BOT } });
  });

  it('pings the link of a key\'s job once for its claim and once for its end when the App cannot mint, as for any end (PRD 2425 s8)', async () => {
    const pings: Ping[] = [];
    const notifier: Notifier = { check: () => Promise.resolve(null), ping: (ping) => { pings.push(ping); } };
    const job = keyJob({ notify_url: 'https://hooks.example.com/omni' });
    const w = world({ jobs: [job], notifier, github: { mint: () => Promise.reject(new Error('GitHub answered 422 to POST /app/installations/9001/access_tokens')) } });
    expect(value(await w.service.next(OLGA, SHARED))).toBeNull();
    expect(w.state.jobs[0]).toMatchObject({ status: 'failed', reason: 'github app: GitHub answered 422 to POST /app/installations/9001/access_tokens' });
    expect(pings.map(({ url, jobId, event }) => [url, jobId, event])).toEqual([
      ['https://hooks.example.com/omni', job.id, 'status'],
      ['https://hooks.example.com/omni', job.id, 'status'],
    ]);
  });
});
