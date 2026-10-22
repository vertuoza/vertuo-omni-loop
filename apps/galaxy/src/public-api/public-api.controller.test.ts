import { describe, expect, it } from 'vitest';
import { API_KEY, jobRow, lineRows, OLGA, OTHER_KEY, questionsRow, SHARED, T0, WORKSPACE } from '../runners/fixtures/store.fake';
import { encodeCursor } from './cursor';
import { fakePublicApi, NORTHWIND, SECRETS, SOUTHWIND, type FakePublicApi } from './fixtures/public-api.fake';
import {
  answerJob, DEAD_KEY, dismissJob, FAILED, getJob, getJobLines, getJobQuestions, listBugFixes, listPrds, startBugFix, startMegaBugFix, NO_DATABASE, NO_KEY, type PublicApiDeps,
} from './public-api.controller';
import { JobLineListSchema, JobSchema, PublicApiErrorSchema, QuestionsSchema } from './public-api.contract';
import { publicApiService } from './public-api.service';
import type { PublicApiRepository } from './public-api.repository';

// GET /api/v1/prds and /api/v1/bug-fixes (PRD 2022 s2) through the real service on rows in memory: the key
// checked first, each dead key 401 in the one error shape; the query next, a bad `limit` or `cursor` 422
// naming it; the lists in the contract's shape, never cached; a failure 500 that never carries the
// database's words.

const ORIGIN = 'https://omni.example';

function deps(api: FakePublicApi | null, logs: string[] = []): PublicApiDeps {
  return { service: api ? publicApiService(api.repository, api.runners) : null, log: (line) => logs.push(line) };
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

  it('answers 202 with every field of a job that has done nothing yet: no outcome, no pull request, no thread (PRD 2425)', async () => {
    const api = fakePublicApi();
    const body: unknown = await (await startBugFix(post(FIX), deps(api))).json();
    expect(body).toMatchObject({
      outcome: null, fixed_by: null, prs: [], questions: null, continues: null, continued_by: null, acting_for: null, cancelled_by: null, log_tail: null,
    });
    expect(JobSchema.parse(body)).toEqual(body);
  });

  describe('what a bug fix did (PRD 2425 s3)', () => {
    const PROVED = 'https://github.com/demo-org/app/pull/512';
    /** A bug fix the first key sent, ended `done` as the report says. */
    function ended(api: FakePublicApi, more: Partial<ReturnType<typeof jobRow>> = {}) {
      const job = jobRow({
        status: 'done', runner_id: SHARED, line: '/omni:bug-fix 548 totals', sent_by: OLGA, sent_by_key: API_KEY, exit_code: 0,
        claimed_at: T0.toISOString(), running_at: T0.toISOString(), ended_at: T0.toISOString(), ...more,
      });
      api.runnersState.jobs.push(job);
      return job;
    }
    const asked = (api: FakePublicApi, id: string, secret: string = SECRETS.runners) => getJob(get(`/api/v1/jobs/${id}`, `Bearer ${secret}`), id, deps(api));

    it('answers 200 with an already_fixed job: its outcome, and the pull request it proved, in snake_case', async () => {
      const api = fakePublicApi();
      const job = ended(api, { outcome: 'already-fixed', fixed_by: PROVED });
      const response = await asked(api, job.id);
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('no-store');
      const body: unknown = await response.json();
      expect(body).toMatchObject({ id: job.id, status: 'done', outcome: 'already_fixed', fixed_by: PROVED, prs: [] });
      expect(JobSchema.parse(body)).toEqual(body);
    });

    it('answers 200 with a pull request as its link, its repository and its number', async () => {
      const api = fakePublicApi();
      const job = ended(api, { outcome: 'pr-opened', pr_url: 'https://github.com/demo-org/app/pull/549', prs: ['https://github.com/demo-org/app/pull/549'] });
      const body: unknown = await (await asked(api, job.id)).json();
      expect(body).toMatchObject({ outcome: 'pr_opened', prs: [{ url: 'https://github.com/demo-org/app/pull/549', repo: 'demo-org/app', number: 549 }] });
    });

    it('answers 200 with need_human and its questions open', async () => {
      const api = fakePublicApi();
      const job = ended(api, { outcome: 'human' });
      api.runnersState.questions.push(questionsRow({ job_id: job.id }));
      expect(await (await asked(api, job.id)).json()).toMatchObject({ outcome: 'need_human', questions: { state: 'open' } });
    });

    it('answers 200 to a second key of the workspace for the first key’s job', async () => {
      const api = fakePublicApi();
      const job = ended(api, { outcome: 'blocked', cancelled_by_key: OTHER_KEY });
      const response = await asked(api, job.id, SECRETS.runnersOther);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ outcome: 'blocked', cancelled_by: { key: 'Support bot', acting_for: null } });
    });

    it('answers 403 to a key whose list leaves the job’s repository out, in the one error shape', async () => {
      const api = fakePublicApi();
      const job = ended(api);
      const response = await asked(api, job.id, SECRETS.runnersLimited);
      expect(response.status).toBe(403);
      expect(await errorOf(response)).toEqual({ code: 'forbidden', message: 'demo-org/app is not on this API key’s list of repositories.' });
    });

    it('answers 404, not 403, to a limited key for a job a person sent', async () => {
      const api = fakePublicApi();
      const job = ended(api, { sent_by_key: null });
      expect((await asked(api, job.id, SECRETS.runnersLimited)).status).toBe(404);
    });
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

describe('GET /api/v1/jobs/{id}/lines (PRD 2425 s4)', () => {
  type Page = { data: { seq: number; text: string }[]; next_cursor: string | null };

  /** A bug fix the first key of the workspace sent, ended `done` in demo-org/app, holding `count` lines. */
  function seeded(api: FakePublicApi, count: number, more: Partial<ReturnType<typeof jobRow>> = {}) {
    const job = jobRow({
      status: 'done', runner_id: SHARED, line: '/omni:bug-fix 548 totals', sent_by: OLGA, sent_by_key: API_KEY, exit_code: 0,
      claimed_at: T0.toISOString(), running_at: T0.toISOString(), ended_at: T0.toISOString(), ...more,
    });
    api.runnersState.jobs.push(job);
    api.runnersState.lines.push(...lineRows(job, 1, count));
    return job;
  }
  const asked = (api: FakePublicApi, id: string, query = '', secret: string | null = SECRETS.runners) =>
    getJobLines(get(`/api/v1/jobs/${id}/lines${query}`, secret === null ? null : `Bearer ${secret}`), id, deps(api));
  const pageOf = async (response: Response) => (await response.json()) as Page;

  it('answers 200 with the job’s lines, oldest first, in the contract’s shape, uncached', async () => {
    const api = fakePublicApi();
    const job = seeded(api, 3);
    const response = await asked(api, job.id);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body: unknown = await response.json();
    expect(body).toEqual({ data: [{ seq: 1, text: 'line 1' }, { seq: 2, text: 'line 2' }, { seq: 3, text: 'line 3' }], next_cursor: null });
    expect(JobLineListSchema.parse(body)).toEqual(body);
  });

  it('pages 120 lines by 50 through next_cursor, each exactly once', async () => {
    const api = fakePublicApi();
    const job = seeded(api, 120);
    const seen: number[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const page = await pageOf(await asked(api, job.id, cursor === null ? '?limit=50' : `?limit=50&cursor=${cursor}`));
      expect(page.data.length).toBeLessThanOrEqual(50);
      seen.push(...page.data.map((line) => line.seq));
      cursor = page.next_cursor;
      pages += 1;
    } while (cursor !== null && pages < 10);
    expect(seen).toEqual([...Array(120).keys()].map((i) => i + 1));
    expect(pages).toBe(3);
  });

  it('pages 50 by default and 100 at most', async () => {
    const api = fakePublicApi();
    const job = seeded(api, 120);
    const count = async (query: string) => (await pageOf(await asked(api, job.id, query))).data.length;
    expect(await count('')).toBe(50);
    expect(await count('?limit=100')).toBe(100);
    expect(await count('?limit=7')).toBe(7);
  });

  it('answers an empty page with no cursor for a job that holds no line', async () => {
    const api = fakePublicApi();
    const job = seeded(api, 0);
    expect(await pageOf(await asked(api, job.id))).toEqual({ data: [], next_cursor: null });
  });

  for (const limit of ['0', '101', 'abc', '', '1.5', '-1']) {
    it(`answers 422 naming limit to limit=${limit}`, async () => {
      const api = fakePublicApi();
      const job = seeded(api, 3);
      const response = await asked(api, job.id, `?limit=${limit}`);
      expect(response.status).toBe(422);
      expect(await errorOf(response)).toEqual({ code: 'invalid_request', message: 'limit: a whole number from 1 to 100.' });
    });
  }

  it('answers 422 naming cursor to a tampered cursor, to the PRD list’s cursor and to another job’s', async () => {
    const api = fakePublicApi();
    const job = seeded(api, 3);
    const other = seeded(api, 3);
    const first = await pageOf(await asked(api, other.id, '?limit=1'));
    const prdsCursor = encodeCursor({ list: 'prds', createdAt: '2026-10-01T09:00:00Z', id: other.id });
    const readsBefore = api.calls.length;
    for (const cursor of ['WyJwcmRzIiwi', 'not-a-cursor', prdsCursor, first.next_cursor ?? '']) {
      const response = await asked(api, job.id, `?cursor=${cursor}`);
      expect(response.status, cursor).toBe(422);
      const error = await errorOf(response);
      expect(error.code).toBe('invalid_request');
      expect(error.message).toMatch(/^cursor: /);
    }
    expect(api.calls.slice(readsBefore)).not.toContain('jobLines');
  });

  describe('the key', () => {
    for (const [what, secret] of [['no header', null], ['an unknown key', SECRETS.unknown], ['a revoked key', SECRETS.revoked], ['a key whose maker left', SECRETS.orphaned]] as const) {
      it(`answers 401 to ${what}, reading no line`, async () => {
        const api = fakePublicApi();
        const job = seeded(api, 3);
        const response = await asked(api, job.id, '', secret);
        expect(response.status).toBe(401);
        expect((await errorOf(response)).code).toBe('unauthorized');
        expect(api.calls).not.toContain('jobLines');
      });
    }

    it('checks the key before the query and before the job', async () => {
      const api = fakePublicApi();
      expect((await asked(api, 'not-an-id', '?limit=0', null)).status).toBe(401);
    });

    it('answers 200 to a second key of the workspace for the first key’s lines', async () => {
      const api = fakePublicApi();
      const job = seeded(api, 2);
      const response = await asked(api, job.id, '', SECRETS.runnersOther);
      expect(response.status).toBe(200);
      expect((await pageOf(response)).data).toHaveLength(2);
    });

    it('answers 403 to a key whose list leaves the job’s repository out, in the one error shape, and 200 for a job on its list', async () => {
      const api = fakePublicApi();
      const off = seeded(api, 2);
      const on = seeded(api, 2, { repo: 'demo-org/other' });
      const refused = await asked(api, off.id, '', SECRETS.runnersLimited);
      expect(refused.status).toBe(403);
      expect(await errorOf(refused)).toEqual({ code: 'forbidden', message: 'demo-org/app is not on this API key’s list of repositories.' });
      expect(api.calls).not.toContain('jobLines');
      expect((await asked(api, on.id, '', SECRETS.runnersLimited)).status).toBe(200);
    });

    it('answers 404, not 403, to a limited key for a job a person sent', async () => {
      const api = fakePublicApi();
      const job = seeded(api, 2, { sent_by_key: null });
      expect((await asked(api, job.id, '', SECRETS.runnersLimited)).status).toBe(404);
    });
  });

  it('answers 404 to a job of another workspace, a person’s job, an unknown job and an id that is none, reading no line', async () => {
    const api = fakePublicApi();
    const mine = seeded(api, 2);
    const person = seeded(api, 2, { sent_by_key: null });
    for (const [id, secret] of [
      [mine.id, SECRETS.all],
      [person.id, SECRETS.runners],
      ['00000000-0000-4000-8000-00000000dead', SECRETS.runners],
      ['not-an-id', SECRETS.runners],
    ] as const) {
      const response = await asked(api, id, '', secret);
      expect(response.status, id).toBe(404);
      expect(await errorOf(response)).toEqual({ code: 'not_found', message: 'No such job.' });
    }
    expect(api.calls).not.toContain('jobLines');
  });

  it('answers 500 without the database’s words when the lines fail, and logs them', async () => {
    const api = fakePublicApi();
    const job = seeded(api, 2);
    const logs: string[] = [];
    const broken: PublicApiRepository = { ...api.repository, jobLines: () => Promise.reject(new Error('runner_job_lines: permission denied for table runner_job_lines')) };
    const response = await getJobLines(
      get(`/api/v1/jobs/${job.id}/lines`, `Bearer ${SECRETS.runners}`), job.id, { service: publicApiService(broken, api.runners), log: (line) => logs.push(line) },
    );
    expect(response.status).toBe(500);
    expect(await errorOf(response)).toEqual({ code: 'internal', message: FAILED });
    expect(logs).toEqual(['public-api: runner_job_lines: permission denied for table runner_job_lines']);
  });

  it('answers 500 when this deployment has no database', async () => {
    const response = await getJobLines(get('/api/v1/jobs/0b4c1d2e-3f40-4a5b-8c6d-7e8f90a1b2c3/lines', `Bearer ${SECRETS.runners}`), '0b4c1d2e-3f40-4a5b-8c6d-7e8f90a1b2c3', deps(null));
    expect(response.status).toBe(500);
    expect(await errorOf(response)).toEqual({ code: 'internal', message: NO_DATABASE });
  });
});

describe('a job’s questions, its answers and its dismissal (PRD 2425 s6)', () => {
  const ANSWERS = { 'Which fix?': 'Guard the input' };
  const ACTED = '00000000-0000-4000-8000-00000000dead';

  /** A bug fix the first key of the workspace sent, ended `done` in demo-org/app with its questions open. */
  function asking(api: FakePublicApi, more: Partial<ReturnType<typeof jobRow>> = {}, open = true) {
    const job = jobRow({
      status: 'done', outcome: 'human', runner_id: SHARED, line: '/omni:bug-fix #314', sent_by: OLGA, sent_by_key: API_KEY, exit_code: 0,
      claimed_at: T0.toISOString(), running_at: T0.toISOString(), ended_at: T0.toISOString(), ...more,
    });
    api.runnersState.jobs.push(job);
    if (open) api.runnersState.questions.push(questionsRow({ job_id: job.id }));
    return job;
  }
  const authorized = (secret: string | null) => (secret === null ? {} : { authorization: `Bearer ${secret}` });
  const post = (path: string, body: unknown, secret: string | null = SECRETS.runners) => new Request(`${ORIGIN}${path}`, {
    method: 'POST', headers: authorized(secret), body: body === undefined ? null : typeof body === 'string' ? body : JSON.stringify(body),
  });
  const read = (api: FakePublicApi, id: string, secret: string | null = SECRETS.runners) =>
    getJobQuestions(get(`/api/v1/jobs/${id}/questions`, secret === null ? null : `Bearer ${secret}`), id, deps(api));
  const answer = (api: FakePublicApi, id: string, body: unknown, secret: string | null = SECRETS.runners) =>
    answerJob(post(`/api/v1/jobs/${id}/answers`, body, secret), id, deps(api));
  const dismiss = (api: FakePublicApi, id: string, body?: unknown, secret: string | null = SECRETS.runners) =>
    dismissJob(post(`/api/v1/jobs/${id}/dismiss`, body, secret), id, deps(api));
  /** Whether no job was queued after the `jobs` seeded ones and no round was closed. */
  const untouched = (api: FakePublicApi, jobs: number) =>
    api.runnersState.jobs.length === jobs && api.runnersState.questions.every((q) => q.closed_at === null);

  describe('GET /api/v1/jobs/{id}/questions', () => {
    it('answers 200 with the lead, the questions and no answer yet, in the contract’s shape, uncached', async () => {
      const api = fakePublicApi();
      const job = asking(api);
      const response = await read(api, job.id);
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('no-store');
      const body: unknown = await response.json();
      expect(body).toEqual({
        lead: 'The planning query fails for 31 tenants.',
        questions: [{
          question: 'Which fix?', header: 'Fix', multi_select: false,
          options: [{ label: 'Guard the input', description: 'Check the tenant before the query' }, { label: 'Design it first', description: 'Stop here and brainstorm the behaviour' }],
        }],
        state: 'open', answers: null, closed_by: null,
      });
      expect(QuestionsSchema.parse(body)).toEqual(body);
    });

    it('answers 200 to a second key of the workspace, and for a job on a repository the key lists', async () => {
      const api = fakePublicApi();
      const job = asking(api, { repo: 'demo-org/other' });
      expect((await read(api, job.id, SECRETS.runnersOther)).status).toBe(200);
      expect((await read(api, job.id, SECRETS.runnersLimited)).status).toBe(200);
    });

    for (const [what, secret] of [['no header', null], ['an unknown key', SECRETS.unknown], ['a revoked key', SECRETS.revoked], ['a key whose maker left', SECRETS.orphaned]] as const) {
      it(`answers 401 to ${what}`, async () => {
        const api = fakePublicApi();
        const response = await read(api, asking(api).id, secret);
        expect(response.status).toBe(401);
        expect((await errorOf(response)).code).toBe('unauthorized');
      });
    }

    it('answers 404 to a job that asked none, a person’s job, another workspace’s, one that is no uuid and one that does not exist', async () => {
      const api = fakePublicApi();
      const quiet = asking(api, {}, false);
      const person = asking(api, { sent_by_key: null });
      const asked = async (id: string, secret = SECRETS.runners) => {
        const response = await read(api, id, secret);
        return [response.status, await errorOf(response)] as const;
      };
      expect(await asked(quiet.id)).toEqual([404, { code: 'not_found', message: 'This job asked no question.' }]);
      expect(await asked(person.id)).toEqual([404, { code: 'not_found', message: 'No such job.' }]);
      expect(await asked(quiet.id, SECRETS.south)).toEqual([404, { code: 'not_found', message: 'No such job.' }]);
      expect(await asked('not-an-id')).toEqual([404, { code: 'not_found', message: 'No such job.' }]);
      expect(await asked(ACTED)).toEqual([404, { code: 'not_found', message: 'No such job.' }]);
    });

    it('answers 403 to a key whose list leaves the job’s repository out', async () => {
      const api = fakePublicApi();
      const response = await read(api, asking(api).id, SECRETS.runnersLimited);
      expect(response.status).toBe(403);
      expect(await errorOf(response)).toEqual({ code: 'forbidden', message: 'demo-org/app is not on this API key’s list of repositories.' });
    });
  });

  describe('POST /api/v1/jobs/{id}/answers', () => {
    it('queues the resume as the key that sent the job and answers 202 with it, continuing the job, uncached', async () => {
      const api = fakePublicApi();
      const job = asking(api);
      const response = await answer(api, job.id, { answers: ANSWERS, acting_for: 'Jane D.' }, SECRETS.runnersOther);
      expect(response.status).toBe(202);
      expect(response.headers.get('cache-control')).toBe('no-store');
      const resume = JobSchema.parse(await response.json());
      expect(resume).toMatchObject({ status: 'queued', repo: 'demo-org/app', continues: job.id, continued_by: null, acting_for: 'Jane D.', line: `/omni:bug-fix #314 --answers ${job.id}` });
      expect(api.runnersState.jobs.find((j) => j.id === resume.id)).toMatchObject({ sent_by: OLGA, sent_by_key: API_KEY, continues: job.id });
      expect(api.runnersState.questions[0]).toMatchObject({ answers: ANSWERS, closed_by: null, closed_by_key: OTHER_KEY, closed_for: 'Jane D.', resume_job: resume.id });
    });

    it('lets the key that sent the job read the resume, the job as carried on by it, and the answers as given', async () => {
      const api = fakePublicApi();
      const job = asking(api);
      const resume = JobSchema.parse(await (await answer(api, job.id, { answers: ANSWERS })).json());
      const reading = async (path: string, id: string, run: (request: Request, id: string, deps: PublicApiDeps) => Promise<Response>): Promise<unknown> =>
        (await run(get(path, `Bearer ${SECRETS.runners}`), id, deps(api))).json() as Promise<unknown>;
      expect(await reading(`/api/v1/jobs/${resume.id}`, resume.id, getJob)).toMatchObject({ id: resume.id, continues: job.id });
      expect(await reading(`/api/v1/jobs/${job.id}`, job.id, getJob)).toMatchObject({ continued_by: resume.id, questions: { state: 'answered' } });
      expect(await reading(`/api/v1/jobs/${job.id}/questions`, job.id, getJobQuestions)).toMatchObject({
        state: 'answered', answers: ANSWERS, closed_by: { key: 'QA dashboard', acting_for: null },
      });
    });

    for (const acting_for of ['Jane D.', 'Zoë', 'Ольга', '李雷', 'María-José O\'Neil', 'ops@acme.example', 'x · y_z', ' padded ', 'a'.repeat(80)]) {
      it(`takes acting_for ${JSON.stringify(acting_for.length > 30 ? `${acting_for.slice(0, 5)}… (80)` : acting_for)} as given`, async () => {
        const api = fakePublicApi();
        const job = asking(api);
        expect((await answer(api, job.id, { answers: ANSWERS, acting_for })).status).toBe(202);
        expect(api.runnersState.questions[0]?.closed_for).toBe(acting_for);
      });
    }

    it('takes no acting_for as acting for no one', async () => {
      const api = fakePublicApi();
      const job = asking(api);
      expect((await answer(api, job.id, { answers: ANSWERS })).status).toBe(202);
      expect(api.runnersState.questions[0]?.closed_for).toBeNull();
    });

    for (const [what, body, field] of [
      ['a body that is not JSON', 'nope', ''],
      ['no body', undefined, ''],
      ['no answers', {}, 'answers'],
      ['an empty answers object', { answers: {} }, 'answers'],
      ['five answers', { answers: { a: 'x', b: 'x', c: 'x', d: 'x', e: 'x' } }, 'answers'],
      ['an empty answer', { answers: { 'Which fix?': '' } }, 'answers'],
      ['a 2,001-character answer', { answers: { 'Which fix?': 'a'.repeat(2001) } }, 'answers'],
      ['an answer that is no string', { answers: { 'Which fix?': 1 } }, 'answers'],
      ['an answers list', { answers: ['Guard the input'] }, 'answers'],
      ['a field it does not know', { answers: ANSWERS, by: 'me' }, 'by'],
      ['an empty acting_for', { answers: ANSWERS, acting_for: '' }, 'acting_for'],
      ['an 81-character acting_for', { answers: ANSWERS, acting_for: 'a'.repeat(81) }, 'acting_for'],
      ['an acting_for with a tag', { answers: ANSWERS, acting_for: '<b>Jane</b>' }, 'acting_for'],
      ['an acting_for with an emoji', { answers: ANSWERS, acting_for: 'Jane 🎉' }, 'acting_for'],
      ['an acting_for with a new line', { answers: ANSWERS, acting_for: 'Jane\nD.' }, 'acting_for'],
      ['an acting_for that is a number', { answers: ANSWERS, acting_for: 12 }, 'acting_for'],
      ['a body over 16 KiB', { answers: ANSWERS, acting_for: 'Jane', pad: 'x'.repeat(16 * 1024) }, ''],
    ] as const) {
      it(`answers 422 to ${what}, naming the field, and closes and queues nothing`, async () => {
        const api = fakePublicApi();
        asking(api);
        const response = await answer(api, api.runnersState.jobs[0]?.id ?? '', body);
        expect(response.status).toBe(422);
        const error = await errorOf(response);
        expect(error.code).toBe('invalid_request');
        expect(error.message).toContain(field);
        expect(untouched(api, 1)).toBe(true);
      });
    }

    it('answers 422 naming answers when they are not one to each question, whichever way', async () => {
      const api = fakePublicApi();
      const job = asking(api);
      for (const answers of [{ 'And the tests?': 'Add one' }, { ...ANSWERS, 'And the tests?': 'Add one' }]) {
        const response = await answer(api, job.id, { answers });
        expect(response.status).toBe(422);
        expect(await errorOf(response)).toEqual({ code: 'invalid_request', message: 'answers: Answer each question once, and only the ones asked.' });
      }
      expect(untouched(api, 1)).toBe(true);
    });

    it('answers 409 conflict to a second answer, from the same key, another, or the page, naming the first, and queues one resume only', async () => {
      const api = fakePublicApi();
      const job = asking(api);
      expect((await answer(api, job.id, { answers: ANSWERS }, SECRETS.runnersOther)).status).toBe(202);
      for (const secret of [SECRETS.runnersOther, SECRETS.runners]) {
        const response = await answer(api, job.id, { answers: ANSWERS }, secret);
        expect(response.status).toBe(409);
        expect(await errorOf(response)).toEqual({ code: 'conflict', message: 'Already answered by API key Support bot' });
      }
      expect(await api.runners.answer(OLGA, job.id, { answers: ANSWERS })).toEqual({ ok: false, kind: 'conflict', error: 'Already answered by API key Support bot' });
      expect(api.runnersState.jobs.filter((j) => j.continues === job.id)).toHaveLength(1);
    });

    it('answers 409 conflict to an answer after the page dismissed the questions, and to a job that is not waiting', async () => {
      const api = fakePublicApi();
      const [dismissed, failed] = [asking(api), asking(api, { status: 'failed', outcome: null })];
      expect(await api.runners.dismiss(OLGA, dismissed.id)).toMatchObject({ ok: true });
      const first = await answer(api, dismissed.id, { answers: ANSWERS });
      expect([first.status, await errorOf(first)]).toEqual([409, { code: 'conflict', message: 'Dismissed by @olga' }]);
      const second = await answer(api, failed.id, { answers: ANSWERS });
      expect([second.status, await errorOf(second)]).toEqual([409, { code: 'conflict', message: 'This job is not waiting for an answer.' }]);
    });

    for (const [what, secret] of [['no header', null], ['an unknown key', SECRETS.unknown], ['a revoked key', SECRETS.revoked], ['a key whose maker left', SECRETS.orphaned]] as const) {
      it(`answers 401 to ${what}, closing and queueing nothing`, async () => {
        const api = fakePublicApi();
        const response = await answer(api, asking(api).id, { answers: ANSWERS }, secret);
        expect(response.status).toBe(401);
        expect((await errorOf(response)).code).toBe('unauthorized');
        expect(untouched(api, 1)).toBe(true);
      });
    }

    it('checks the key before the body, and the body before the job', async () => {
      const api = fakePublicApi();
      expect((await answer(api, 'not-an-id', 'nope', null)).status).toBe(401);
      expect((await answer(api, 'not-an-id', 'nope')).status).toBe(422);
      expect((await answer(api, 'not-an-id', { answers: ANSWERS })).status).toBe(404);
    });

    it('answers 404 to a job that asked none, a person’s, another workspace’s, no uuid and none, and queues nothing', async () => {
      const api = fakePublicApi();
      const quiet = asking(api, {}, false);
      const person = asking(api, { sent_by_key: null });
      const mine = asking(api);
      const statusOf = async (id: string, secret = SECRETS.runners) => (await answer(api, id, { answers: ANSWERS }, secret)).status;
      expect([await statusOf(quiet.id), await statusOf(person.id), await statusOf(mine.id, SECRETS.south), await statusOf('not-an-id'), await statusOf(ACTED)]).toEqual([404, 404, 404, 404, 404]);
      expect(untouched(api, 3)).toBe(true);
    });

    it('answers 403 to a key whose list leaves the job’s repository out, and closes and queues nothing', async () => {
      const api = fakePublicApi();
      const response = await answer(api, asking(api).id, { answers: ANSWERS }, SECRETS.runnersLimited);
      expect(response.status).toBe(403);
      expect((await errorOf(response)).code).toBe('forbidden');
      expect(untouched(api, 1)).toBe(true);
    });
  });

  describe('POST /api/v1/jobs/{id}/dismiss', () => {
    it('closes the round with no answer, queues nothing and answers 200 with the job, its questions dismissed, uncached', async () => {
      const api = fakePublicApi();
      const job = asking(api);
      const response = await dismiss(api, job.id, { acting_for: 'Jane D.' }, SECRETS.runnersOther);
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(JobSchema.parse(await response.json())).toMatchObject({ id: job.id, questions: { state: 'dismissed' }, continued_by: null });
      expect(api.runnersState.jobs).toHaveLength(1);
      expect(api.runnersState.questions[0]).toMatchObject({ answers: null, closed_by: null, closed_by_key: OTHER_KEY, closed_for: 'Jane D.', resume_job: null });
    });

    for (const [what, body] of [['no body', undefined], ['an empty body', ''], ['a blank body', '  \n'], ['an empty object', {}]] as const) {
      it(`takes ${what} as acting for no one`, async () => {
        const api = fakePublicApi();
        const job = asking(api);
        expect((await dismiss(api, job.id, body)).status).toBe(200);
        expect(api.runnersState.questions[0]).toMatchObject({ closed_by_key: API_KEY, closed_for: null });
      });
    }

    it('reads the dismissal back, the key by its name', async () => {
      const api = fakePublicApi();
      const job = asking(api);
      await dismiss(api, job.id, { acting_for: 'Jane D.' }, SECRETS.runnersOther);
      expect(await (await read(api, job.id)).json()).toMatchObject({ state: 'dismissed', answers: null, closed_by: { key: 'Support bot', acting_for: 'Jane D.' } });
    });

    for (const [what, body, field] of [
      ['a body that is not JSON', 'nope', ''],
      ['answers', { answers: ANSWERS }, 'answers'],
      ['an empty acting_for', { acting_for: '' }, 'acting_for'],
      ['an 81-character acting_for', { acting_for: 'a'.repeat(81) }, 'acting_for'],
      ['an acting_for with a semicolon', { acting_for: 'x; rm' }, 'acting_for'],
      ['a body over 16 KiB', { acting_for: 'Jane', pad: 'x'.repeat(16 * 1024) }, ''],
    ] as const) {
      it(`answers 422 to ${what}, naming the field, and closes nothing`, async () => {
        const api = fakePublicApi();
        const response = await dismiss(api, asking(api).id, body);
        expect(response.status).toBe(422);
        const error = await errorOf(response);
        expect(error.code).toBe('invalid_request');
        expect(error.message).toContain(field);
        expect(untouched(api, 1)).toBe(true);
      });
    }

    it('answers 409 conflict to a second dismissal or an answer after it, naming the first', async () => {
      const api = fakePublicApi();
      const job = asking(api);
      expect((await dismiss(api, job.id, undefined, SECRETS.runnersOther)).status).toBe(200);
      const again = await dismiss(api, job.id);
      expect([again.status, await errorOf(again)]).toEqual([409, { code: 'conflict', message: 'Dismissed by API key Support bot' }]);
      const late = await answer(api, job.id, { answers: ANSWERS });
      expect([late.status, await errorOf(late)]).toEqual([409, { code: 'conflict', message: 'Dismissed by API key Support bot' }]);
      expect(api.runnersState.jobs).toHaveLength(1);
    });

    for (const [what, secret] of [['no header', null], ['an unknown key', SECRETS.unknown], ['a revoked key', SECRETS.revoked]] as const) {
      it(`answers 401 to ${what}, closing nothing`, async () => {
        const api = fakePublicApi();
        const response = await dismiss(api, asking(api).id, undefined, secret);
        expect(response.status).toBe(401);
        expect(untouched(api, 1)).toBe(true);
      });
    }

    it('answers 404 to the jobs a key learns nothing of, and 403 off its list, closing nothing', async () => {
      const api = fakePublicApi();
      const quiet = asking(api, {}, false);
      const person = asking(api, { sent_by_key: null });
      const mine = asking(api);
      const statusOf = async (id: string, secret = SECRETS.runners) => (await dismiss(api, id, undefined, secret)).status;
      expect([await statusOf(quiet.id), await statusOf(person.id), await statusOf(mine.id, SECRETS.south), await statusOf('not-an-id'), await statusOf(ACTED)]).toEqual([404, 404, 404, 404, 404]);
      expect(await statusOf(mine.id, SECRETS.runnersLimited)).toBe(403);
      expect(untouched(api, 3)).toBe(true);
    });
  });

  describe('a failure', () => {
    it('answers 500 that never carries the database’s words, for a read, an answer and a dismissal', async () => {
      const api = fakePublicApi();
      const job = asking(api);
      const logs: string[] = [];
      const gone = () => Promise.reject(new Error('relation "runner_job_questions" is gone'));
      const broken: PublicApiDeps = {
        ...deps(api, logs),
        service: publicApiService(api.repository, { ...api.runners, questionsByKey: gone, answerByKey: gone, dismissByKey: gone }),
      };
      const responses = [
        await getJobQuestions(get(`/api/v1/jobs/${job.id}/questions`, `Bearer ${SECRETS.runners}`), job.id, broken),
        await answerJob(post(`/api/v1/jobs/${job.id}/answers`, { answers: ANSWERS }), job.id, broken),
        await dismissJob(post(`/api/v1/jobs/${job.id}/dismiss`, undefined), job.id, broken),
      ];
      for (const response of responses) {
        expect(response.status).toBe(500);
        expect(await errorOf(response)).toEqual({ code: 'internal', message: FAILED });
      }
      expect(logs).toHaveLength(3);
    });
  });
});
