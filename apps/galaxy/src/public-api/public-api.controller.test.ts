import { describe, expect, it } from 'vitest';
import { API_KEY, OLGA, WORKSPACE } from '../runners/fixtures/store.fake';
import { fakePublicApi, NORTHWIND, SECRETS, SOUTHWIND, type FakePublicApi } from './fixtures/public-api.fake';
import { DEAD_KEY, FAILED, getJob, listBugFixes, listPrds, startBugFix, startMegaBugFix, NO_DATABASE, NO_KEY, type PublicApiDeps } from './public-api.controller';
import { JobSchema, PublicApiErrorSchema } from './public-api.contract';
import { publicApiService, type CheckInstallation, type InstallationCheck } from './public-api.service';
import type { PublicApiRepository } from './public-api.repository';

// GET /api/v1/prds and /api/v1/bug-fixes (PRD 2022 s2) through the real service on rows in memory: the key
// checked first, each dead key 401 in the one error shape; the query next, a bad `limit` or `cursor` 422
// naming it; the lists in the contract's shape, never cached; a failure 500 that never carries the
// database's words.

const ORIGIN = 'https://omni.example';

function deps(api: FakePublicApi | null, logs: string[] = [], installation: CheckInstallation | null = null): PublicApiDeps {
  return { service: api ? publicApiService(api.repository, api.runners, installation) : null, log: (line) => logs.push(line) };
}

function get(path: string, authorization: string | null = `Bearer ${SECRETS.all}`): Request {
  return new Request(`${ORIGIN}${path}`, { headers: authorization === null ? {} : { authorization } });
}

async function errorOf(response: Response) {
  return PublicApiErrorSchema.parse(await response.json()).error;
}

describe('the key', () => {
  for (const [what, authorization] of [
    ['no header', null],
    ['an empty bearer', 'Bearer '],
    ['another scheme', `Basic ${SECRETS.all}`],
    ['a wrong prefix', `Bearer omb_${'x'.repeat(43)}`],
    ['two words', `Bearer ${SECRETS.all} ${SECRETS.all}`],
  ] as const) {
    it(`answers 401 to ${what}, reading nothing`, async () => {
      const api = fakePublicApi();
      api.prd(NORTHWIND, 'northwind/backend', 1);
      const response = await listPrds(get('/api/v1/prds', authorization), deps(api));
      expect(response.status).toBe(401);
      expect((await errorOf(response)).code).toBe('unauthorized');
      expect(api.calls.filter((call) => call !== 'keyOf')).toEqual([]);
    });
  }

  it('says how to send the key when none came', async () => {
    expect(await errorOf(await listPrds(get('/api/v1/prds', null), deps(fakePublicApi())))).toEqual({ code: 'unauthorized', message: NO_KEY });
  });

  for (const [what, secret] of [['an unknown key', SECRETS.unknown], ['a revoked key', SECRETS.revoked], ['a key whose maker left', SECRETS.orphaned]] as const) {
    it(`answers 401 to ${what}, on both lists, saying no more than that it is dead`, async () => {
      const api = fakePublicApi();
      api.prd(NORTHWIND, 'northwind/backend', 1);
      api.bug(NORTHWIND, 'northwind/backend', 2);
      for (const route of [listPrds, listBugFixes]) {
        const response = await route(get('/api/v1/prds', `Bearer ${secret}`), deps(api));
        expect(response.status).toBe(401);
        expect(await errorOf(response)).toEqual({ code: 'unauthorized', message: DEAD_KEY });
      }
      expect(api.calls).toEqual(['keyOf', 'keyOf']);
    });
  }

  it('takes the scheme in any case', async () => {
    expect((await listPrds(get('/api/v1/prds', `bearer ${SECRETS.all}`), deps(fakePublicApi()))).status).toBe(200);
  });
});

describe('the query', () => {
  for (const limit of ['0', '101', 'abc', '', '1.5', '-1']) {
    it(`answers 422 naming limit to limit=${limit}`, async () => {
      const response = await listPrds(get(`/api/v1/prds?limit=${limit}`), deps(fakePublicApi()));
      expect(response.status).toBe(422);
      const error = await errorOf(response);
      expect(error.code).toBe('invalid_request');
      expect(error.message).toMatch(/^limit: /);
    });
  }

  it('answers 422 naming cursor to a tampered cursor, on both lists', async () => {
    for (const route of [listPrds, listBugFixes]) {
      const response = await route(get('/api/v1/prds?cursor=WyJwcmRzIiwi'), deps(fakePublicApi()));
      expect(response.status).toBe(422);
      const error = await errorOf(response);
      expect(error.code).toBe('invalid_request');
      expect(error.message).toMatch(/^cursor: /);
    }
  });

  it('checks the key before the query', async () => {
    expect((await listPrds(get('/api/v1/prds?limit=0', null), deps(fakePublicApi()))).status).toBe(401);
  });

  it('pages 50 by default and 100 at most', async () => {
    const api = fakePublicApi();
    for (let n = 1; n <= 120; n += 1) api.prd(NORTHWIND, 'northwind/backend', n);
    const count = async (path: string) => ((await (await listPrds(get(path), deps(api))).json()) as { data: unknown[] }).data.length;
    expect(await count('/api/v1/prds')).toBe(50);
    expect(await count('/api/v1/prds?limit=100')).toBe(100);
    expect(await count('/api/v1/prds?limit=7')).toBe(7);
  });
});

describe('the lists', () => {
  it('answers the key’s PRDs, uncached, with their pages on this origin', async () => {
    const api = fakePublicApi();
    const mine = api.prd(NORTHWIND, 'northwind/backend', 42);
    api.prd(SOUTHWIND, 'southwind/backend', 1);
    const response = await listPrds(get('/api/v1/prds'), deps(api));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      data: [{
        id: mine.id, ref: '42', number: 42, title: mine.title, repo: 'northwind/backend', product: null, stage: null, created_at: mine.created_at,
        links: { page: `${ORIGIN}/prd/${mine.id}`, issue: 'https://github.com/northwind/backend/issues/42' },
      }],
      next_cursor: null,
    });
  });

  it('follows next_cursor through every bug fix of the allow-list, exactly once', async () => {
    const api = fakePublicApi();
    for (let n = 1; n <= 30; n += 1) api.bug(NORTHWIND, n % 3 === 0 ? 'northwind/web' : 'northwind/backend', n);
    const seen: number[] = [];
    let path = '/api/v1/bug-fixes?limit=4';
    for (let pages = 0; pages < 20; pages += 1) {
      const body = (await (await listBugFixes(get(path, `Bearer ${SECRETS.backend}`), deps(api))).json()) as { data: { number: number; repo: string }[]; next_cursor: string | null };
      seen.push(...body.data.map((b) => b.number));
      expect(body.data.every((b) => b.repo === 'northwind/backend')).toBe(true);
      if (body.next_cursor === null) break;
      path = `/api/v1/bug-fixes?limit=4&cursor=${encodeURIComponent(body.next_cursor)}`;
    }
    const backend = [...Array(30).keys()].map((i) => 30 - i).filter((n) => n % 3 !== 0);
    expect(seen).toEqual(backend);
  });
});

describe('a failure', () => {
  it('answers 500 without the database’s words, and logs them', async () => {
    const api = fakePublicApi();
    const broken: PublicApiRepository = { ...api.repository, dossiers: () => Promise.reject(new Error('dossiers: permission denied for table dossiers')) };
    const logs: string[] = [];
    const response = await listPrds(get('/api/v1/prds'), { service: publicApiService(broken, api.runners), log: (line) => logs.push(line) });
    expect(response.status).toBe(500);
    expect(await errorOf(response)).toEqual({ code: 'internal', message: FAILED });
    expect(logs).toEqual(['public-api: dossiers: permission denied for table dossiers']);
  });

  it('answers 500 when this deployment has no database', async () => {
    const response = await listBugFixes(get('/api/v1/bug-fixes'), deps(null));
    expect(response.status).toBe(500);
    expect(await errorOf(response)).toEqual({ code: 'internal', message: NO_DATABASE });
  });
});

describe('POST /api/v1/bug-fixes and GET /api/v1/jobs/{id} (PRD 2022 s4)', () => {
  const post = (body: unknown, authorization: string | null = `Bearer ${SECRETS.runners}`) => new Request(`${ORIGIN}/api/v1/bug-fixes`, {
    method: 'POST', headers: authorization === null ? {} : { authorization }, body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  const FIX = { repo: 'demo-org/app', description: 'Issue 548 the invoice total is off by a cent' };

  it('queues the bug fix on the runners and answers 202 with the job, sent by the key', async () => {
    const api = fakePublicApi();
    const response = await startBugFix(post(FIX), deps(api));
    expect(response.status).toBe(202);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const job = JobSchema.parse(await response.json());
    expect(job).toMatchObject({ status: 'queued', repo: 'demo-org/app', runner: null, pr_url: null, line: `/omni:bug-fix ${FIX.description}` });
    expect(api.runnersState.jobs[0]).toMatchObject({ id: job.id, sent_by_key: API_KEY, sent_by: OLGA, line: job.line });
  });

  it('sends to a runner by its name', async () => {
    const api = fakePublicApi();
    const response = await startBugFix(post({ ...FIX, runner: 'cia-box' }), deps(api));
    expect(response.status).toBe(202);
    expect(api.runnersState.jobs[0]?.to_runner).toBeTruthy();
  });

  it('answers 401 without a live key, queueing nothing', async () => {
    const api = fakePublicApi();
    for (const authorization of [null, `Bearer ${SECRETS.revoked}`, `Bearer ${SECRETS.unknown}`]) {
      const response = await startBugFix(post(FIX, authorization), deps(api));
      expect(response.status).toBe(401);
      expect((await errorOf(response)).code).toBe('unauthorized');
    }
    expect(api.runnersState.jobs).toEqual([]);
  });

  it('answers 403 for a repository outside the workspace or the key’s allow-list', async () => {
    const api = fakePublicApi();
    const elsewhere = await startBugFix(post({ ...FIX, repo: 'elsewhere/app' }), deps(api));
    expect(elsewhere.status).toBe(403);
    expect((await errorOf(elsewhere)).code).toBe('forbidden');
    const limited = await startBugFix(post(FIX, `Bearer ${SECRETS.runnersLimited}`), deps(api));
    expect(limited.status).toBe(403);
    expect((await errorOf(limited)).message).toContain('demo-org/app');
    expect(api.runnersState.jobs).toEqual([]);
  });

  it('queues a 186-character description, a line of 200 with /omni:bug-fix', async () => {
    const api = fakePublicApi();
    const response = await startBugFix(post({ ...FIX, description: 'a'.repeat(186) }), deps(api));
    expect(response.status).toBe(202);
    expect(JobSchema.parse(await response.json()).line).toHaveLength(200);
  });

  for (const [what, body, field] of [
    ['an empty description', { ...FIX, description: '' }, 'description'],
    ['a 187-character description', { ...FIX, description: 'a'.repeat(187) }, 'description'],
    ['a description with shell characters', { ...FIX, description: 'x; rm -rf ~' }, 'description'],
    ['a description of quotes and substitutions', { ...FIX, description: "it's $(whoami)" }, 'description'],
    ['no repository', { description: 'x' }, 'repo'],
    ['a repository that is not owner/name', { ...FIX, repo: 'app' }, 'repo'],
    ['an unknown runner', { ...FIX, runner: 'ghost' }, 'runner or fleet'],
    ['a runner and a fleet', { ...FIX, runner: 'shared', fleet: 'cia' }, 'description'],
    ['a body that is not JSON', 'nope', ''],
  ] as const) {
    it(`answers 422 to ${what}, naming the field, and queues nothing`, async () => {
      const api = fakePublicApi();
      const response = await startBugFix(post(body), deps(api));
      expect(response.status).toBe(422);
      const error = await errorOf(response);
      expect(error.code).toBe('invalid_request');
      expect(error.message).toContain(field);
      expect(api.runnersState.jobs).toEqual([]);
    });
  }

  it('follows the job it queued to done, with the pull request’s link', async () => {
    const api = fakePublicApi();
    const queued = JobSchema.parse(await (await startBugFix(post(FIX), deps(api))).json());
    const asked = () => getJob(get(`/api/v1/jobs/${queued.id}`, `Bearer ${SECRETS.runners}`), queued.id, deps(api));
    expect(await (await asked()).json()).toMatchObject({ id: queued.id, status: 'queued', runner: null });
    const job = api.runnersState.jobs[0];
    if (!job) throw new Error('queued');
    Object.assign(job, { status: 'done', runner_id: '00000000-0000-4000-8000-0000018301a1', pr_url: 'https://github.com/demo-org/app/pull/549', exit_code: 0 });
    const done = await asked();
    expect(done.status).toBe(200);
    expect(JobSchema.parse(await done.json())).toMatchObject({ status: 'done', runner: 'shared', pr_url: 'https://github.com/demo-org/app/pull/549', exit_code: 0 });
  });

  it('answers 404 to a job of another workspace, a person’s job, an unknown job and an id that is none', async () => {
    const api = fakePublicApi();
    const queued = JobSchema.parse(await (await startBugFix(post(FIX), deps(api))).json());
    const person = await api.runners.send('00000000-0000-4000-8000-0000018300b1', { line: '/omni:yolo 1', repo: 'demo-org/app', target: { kind: 'any' } });
    const personId = person.ok ? person.value.id : '';
    for (const [id, secret] of [
      [queued.id, SECRETS.all],
      [personId, SECRETS.runners],
      ['00000000-0000-4000-8000-00000000dead', SECRETS.runners],
      ['not-an-id', SECRETS.runners],
    ] as const) {
      const response = await getJob(get(`/api/v1/jobs/${id}`, `Bearer ${secret}`), id, deps(api));
      expect(response.status, id).toBe(404);
      expect((await errorOf(response)).code).toBe('not_found');
    }
  });

  it('answers 401 to a job asked without a live key', async () => {
    const api = fakePublicApi();
    const response = await getJob(get('/api/v1/jobs/x', null), 'x', deps(api));
    expect(response.status).toBe(401);
  });

  it('answers 500 without the runners’ words when they fail', async () => {
    const api = fakePublicApi();
    const logs: string[] = [];
    const broken = { ...api.runners, sendByKey: () => Promise.reject(new Error('runner_jobs: permission denied')) };
    const response = await startBugFix(post(FIX), { service: publicApiService(api.repository, broken), log: (line) => logs.push(line) });
    expect(response.status).toBe(500);
    expect(await errorOf(response)).toEqual({ code: 'internal', message: FAILED });
    expect(logs).toEqual(['public-api: runner_jobs: permission denied']);
  });
});

describe('POST /api/v1/mega-bug-fixes', () => {
  const post = (body: unknown, authorization: string | null = `Bearer ${SECRETS.runners}`) => new Request(`${ORIGIN}/api/v1/mega-bug-fixes`, {
    method: 'POST', headers: authorization === null ? {} : { authorization }, body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  const ISSUE = 'https://github.com/demo-org/plan/issues/612';
  const FIX = { repo: 'demo-org/plan', description: ISSUE };

  /** The fake, with demo-org/plan named as a plan repository of the runners' workspace. */
  function withPlan(): FakePublicApi {
    const api = fakePublicApi();
    api.planRepository(WORKSPACE, 'demo-org/plan');
    return api;
  }

  it('queues /omni:mega-bug-fix in the plan repository and answers 202 with the job, sent by the key', async () => {
    const api = withPlan();
    const response = await startMegaBugFix(post(FIX), deps(api));
    expect(response.status).toBe(202);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const job = JobSchema.parse(await response.json());
    expect(job).toMatchObject({ status: 'queued', repo: 'demo-org/plan', runner: null, pr_url: null, line: `/omni:mega-bug-fix ${ISSUE}` });
    expect(api.runnersState.jobs[0]).toMatchObject({ id: job.id, sent_by_key: API_KEY, sent_by: OLGA, line: job.line });
  });

  it('is followed as any job a key queued', async () => {
    const api = withPlan();
    const queued = JobSchema.parse(await (await startMegaBugFix(post({ ...FIX, runner: 'cia-box' }), deps(api))).json());
    const asked = await getJob(get(`/api/v1/jobs/${queued.id}`, `Bearer ${SECRETS.runners}`), queued.id, deps(api));
    expect(asked.status).toBe(200);
    expect(await asked.json()).toMatchObject({ id: queued.id, line: `/omni:mega-bug-fix ${ISSUE}`, status: 'queued' });
  });

  it('answers 401 without a live key, queueing nothing', async () => {
    const api = withPlan();
    for (const authorization of [null, `Bearer ${SECRETS.revoked}`, `Bearer ${SECRETS.unknown}`]) {
      const response = await startMegaBugFix(post(FIX, authorization), deps(api));
      expect(response.status).toBe(401);
      expect((await errorOf(response)).code).toBe('unauthorized');
    }
    expect(api.runnersState.jobs).toEqual([]);
  });

  it('answers 403 for a plan repository off the key’s allow-list', async () => {
    const api = withPlan();
    const response = await startMegaBugFix(post(FIX, `Bearer ${SECRETS.runnersLimited}`), deps(api));
    expect(response.status).toBe(403);
    expect(await errorOf(response)).toEqual({ code: 'forbidden', message: 'demo-org/plan is not on this API key’s list of repositories.' });
    expect(api.runnersState.jobs).toEqual([]);
  });

  for (const [what, body, field] of [
    ['a repository that is no plan repository', { ...FIX, repo: 'demo-org/app' }, 'repo: demo-org/app is not a plan repository'],
    ['a repository outside the workspace', { ...FIX, repo: 'elsewhere/plan' }, 'repo: elsewhere/plan is not a plan repository'],
    ['a field it does not know', { ...FIX, skill: 'bug-fix' }, 'skill: '],
    ['a --product flag', { ...FIX, description: `${ISSUE} --product mobile` }, 'description: '],
    ['a 182-character description', { ...FIX, description: 'a'.repeat(182) }, 'description: '],
    ['a description with shell characters', { ...FIX, description: 'x; rm -rf ~' }, 'description: '],
    ['no repository', { description: ISSUE }, 'repo: '],
    ['an unknown runner', { ...FIX, runner: 'ghost' }, 'runner or fleet: '],
    ['a body that is not JSON', 'nope', 'The body must be'],
  ] as const) {
    it(`answers 422 to ${what}, naming the field, and queues nothing`, async () => {
      const api = withPlan();
      const response = await startMegaBugFix(post(body), deps(api));
      expect(response.status).toBe(422);
      const error = await errorOf(response);
      expect(error.code).toBe('invalid_request');
      expect(error.message.startsWith(field), error.message).toBe(true);
      expect(api.runnersState.jobs).toEqual([]);
    });
  }

  it('answers 500 without the database’s words when the plan check fails, and 500 with no database', async () => {
    const api = withPlan();
    const logs: string[] = [];
    const broken = { ...api.repository, isPlanRepository: () => Promise.reject(new Error('products.plan_repository: permission denied')) };
    const response = await startMegaBugFix(post(FIX), { service: publicApiService(broken, api.runners), log: (line) => logs.push(line) });
    expect(response.status).toBe(500);
    expect(await errorOf(response)).toEqual({ code: 'internal', message: FAILED });
    expect(logs).toEqual(['public-api: products.plan_repository: permission denied']);
    const none = await startMegaBugFix(post(FIX), deps(null));
    expect(none.status).toBe(500);
    expect(await errorOf(none)).toEqual({ code: 'internal', message: NO_DATABASE });
  });
});

describe('POST /api/v1/bug-fixes and /mega-bug-fixes from a key with a GitHub App (PRD 2433 s6)', () => {
  const ROUTES = [
    { route: 'bug-fixes', start: startBugFix, body: { repo: 'demo-org/app', description: 'Issue 548 totals' } },
    { route: 'mega-bug-fixes', start: startMegaBugFix, body: { repo: 'demo-org/plan', description: 'https://github.com/demo-org/plan/issues/612' } },
  ] as const;
  const post = (route: string, body: unknown) => new Request(`${ORIGIN}/api/v1/${route}`, {
    method: 'POST', headers: { authorization: `Bearer ${SECRETS.runners}` }, body: JSON.stringify(body),
  });

  /** The fake, the runners' key holding an App and demo-org/plan a plan repository, and a GitHub answering `answer`. */
  function setup(answer: InstallationCheck | Error) {
    const api = fakePublicApi();
    api.githubApp(API_KEY, { slug: 'acme-bot' });
    api.planRepository(WORKSPACE, 'demo-org/plan');
    const asked: string[] = [];
    const check: CheckInstallation = (_app, repo) => {
      asked.push(repo);
      return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
    };
    return { api, asked, check };
  }

  for (const { route, start, body } of ROUTES) {
    it(`answers 422 github_app_not_installed on /${route}, naming the repository, and queues nothing`, async () => {
      const { api, asked, check } = setup({ installed: false });
      const response = await start(post(route, body), deps(api, [], check));
      expect(response.status).toBe(422);
      expect(response.headers.get('cache-control')).toBe('no-store');
      const error = await errorOf(response);
      expect(error.code).toBe('github_app_not_installed');
      expect(error.message).toContain(body.repo);
      expect(asked).toEqual([body.repo]);
      expect(api.runnersState.jobs).toEqual([]);
    });

    it(`answers 422 github_app_permissions on /${route}, naming the permission, and queues nothing`, async () => {
      const { api, check } = setup({ installed: true, missing: 'pull_requests' });
      const response = await start(post(route, body), deps(api, [], check));
      expect(response.status).toBe(422);
      const error = await errorOf(response);
      expect(error.code).toBe('github_app_permissions');
      expect(error.message).toContain('pull_requests');
      expect(error.message).toContain(body.repo);
      expect(api.runnersState.jobs).toEqual([]);
    });

    it(`queues /${route} with 202 where the App is installed with the three permissions`, async () => {
      const { api, check } = setup({ installed: true, missing: null });
      const response = await start(post(route, body), deps(api, [], check));
      expect(response.status).toBe(202);
      expect(JobSchema.parse(await response.json())).toMatchObject({ status: 'queued', repo: body.repo });
      expect(api.runnersState.jobs).toHaveLength(1);
    });

    it(`answers 500 on /${route} without GitHub's words when GitHub cannot be asked, logging them, and queues nothing`, async () => {
      const { api, check } = setup(new Error('GitHub answered 502 to GET /repos/demo-org/app/installation'));
      const logs: string[] = [];
      const response = await start(post(route, body), deps(api, logs, check));
      expect(response.status).toBe(500);
      expect(await errorOf(response)).toEqual({ code: 'internal', message: FAILED });
      expect(logs).toEqual(['public-api: GitHub answered 502 to GET /repos/demo-org/app/installation']);
      expect(api.runnersState.jobs).toEqual([]);
    });

    it(`answers 500 on /${route} without the database's words when the App's sealed key cannot be opened, and queues nothing`, async () => {
      const { api, check } = setup({ installed: true, missing: null });
      const logs: string[] = [];
      const broken = { ...api.repository, githubAppOf: () => Promise.reject(new Error('api_key_github_app_of_key: Could not find the function')) };
      const response = await start(post(route, body), { service: publicApiService(broken, api.runners, check), log: (line) => logs.push(line) });
      expect(response.status).toBe(500);
      expect(await errorOf(response)).toEqual({ code: 'internal', message: FAILED });
      expect(logs).toEqual(['public-api: api_key_github_app_of_key: Could not find the function']);
      expect(api.runnersState.jobs).toEqual([]);
    });
  }

  it('asks GitHub nothing for a key with no App', async () => {
    const api = fakePublicApi();
    const asked: string[] = [];
    const check: CheckInstallation = (_app, repo) => { asked.push(repo); return Promise.resolve({ installed: false }); };
    const response = await startBugFix(post('bug-fixes', ROUTES[0].body), deps(api, [], check));
    expect(response.status).toBe(202);
    expect(asked).toEqual([]);
  });
});
