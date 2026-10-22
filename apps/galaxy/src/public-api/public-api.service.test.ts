import { describe, expect, it } from 'vitest';
import { parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { checkRunnerLine, LINE_MAX } from 'omni-loop/kit/lib/runner/line.ts';
import { API_KEY, EVE, jobRow, lineRows, OLGA, OTHER_KEY, questionsRow, SAM, SHARED, T0, WORKSPACE } from '../runners/fixtures/store.fake';
import { encodeCursor, encodeLinesCursor } from './cursor';
import { fakePublicApi, NORTHWIND, SECRETS, SOUTHWIND, type FakePublicApi } from './fixtures/public-api.fake';
import { BugFixListSchema, DESCRIPTION_MAX, MEGA_DESCRIPTION_MAX, PrdListSchema, type ApiJob, type ListQuery, type StartBugFix } from './public-api.contract';
import { BAD_CURSOR, publicApiService, type Answered, type ApiKeyCaller, type RunnersPort } from './public-api.service';

// The public API's rules (PRD 2022 s2) on realistic rows in memory: a key is a live key of its shape;
// a key lists only its own workspace's dossiers (BR-PRODUCT-63), only those of its allow-list when it has
// one, and no product PRD then; the lists page newest first by the cursor, each row exactly once while
// rows are added between pages; each row in the shape the spec names.

const ORIGIN = 'https://omni.example';
const FIRST: ListQuery = { limit: 50 };

async function caller(api: FakePublicApi, secret: string): Promise<ApiKeyCaller> {
  const key = await publicApiService(api.repository, api.runners).keyFor(secret);
  if (!key) throw new Error('the fixture key is not live');
  return key;
}

/** Every row of a list, following next_cursor until it is null, with `between` run before each next page. */
async function everyPrd(api: FakePublicApi, key: ApiKeyCaller, limit: number, between: () => void = () => {}) {
  const service = publicApiService(api.repository, api.runners);
  const seen: string[] = [];
  let cursor: string | undefined;
  for (let pages = 0; pages < 20; pages += 1) {
    const page = await service.prds(key, cursor === undefined ? { limit } : { limit, cursor }, ORIGIN);
    if (!page.ok) throw new Error(page.message);
    expect(page.value.data.length).toBeLessThanOrEqual(limit);
    seen.push(...page.value.data.map((p) => p.id));
    if (page.value.next_cursor === null) return { seen, pages: pages + 1 };
    cursor = page.value.next_cursor;
    between();
  }
  throw new Error('the cursor never ended');
}

describe('a key', () => {
  it('is the live key its secret hashes to', async () => {
    const api = fakePublicApi();
    expect(await publicApiService(api.repository, api.runners).keyFor(SECRETS.backend)).toEqual({
      id: 'k-backend', name: 'Backend bot', workspace: NORTHWIND, repos: ['northwind/backend'], maker: '00000000-0000-4000-8000-0000000000a1',
    });
  });

  it('is nobody when unknown, revoked, or its maker left', async () => {
    const service = publicApiService(fakePublicApi().repository, fakePublicApi().runners);
    for (const secret of [SECRETS.unknown, SECRETS.revoked, SECRETS.orphaned]) expect(await service.keyFor(secret)).toBeNull();
  });

  it('never looks up a secret of another shape', async () => {
    const api = fakePublicApi();
    const service = publicApiService(api.repository, api.runners);
    for (const secret of ['', 'omb_' + 'x'.repeat(43), 'omk_' + 'x'.repeat(43), SECRETS.all.slice(0, -1), `${SECRETS.all} `]) {
      expect(await service.keyFor(secret)).toBeNull();
    }
    expect(api.calls).toEqual([]);
  });
});

describe('the PRD list', () => {
  it('answers each PRD in the spec’s shape, newest first', async () => {
    const api = fakePublicApi();
    api.product(NORTHWIND, 'p-mobile', 'mobile', 'Mobile app');
    const older = api.prd(NORTHWIND, 'northwind/backend', 7, { product_id: 'p-mobile', title: 'Faster invoices' });
    api.stage(NORTHWIND, 'northwind/backend', parsePrd(7), 'inbox');
    api.stage(NORTHWIND, 'northwind/backend', parsePrd(7), 'building');
    api.stage(NORTHWIND, 'northwind/backend', parsePrd(7), 'prd');
    const productPrd = api.add({ workspace: NORTHWIND, kind: 'prd', product_seq: 12, product_id: 'p-mobile', title: 'Offline mode' });

    const page = await publicApiService(api.repository, api.runners).prds(await caller(api, SECRETS.all), FIRST, ORIGIN);

    expect(page).toEqual({
      ok: true,
      value: {
        data: [
          {
            id: productPrd.id, ref: 'mobile-12', number: 12, title: 'Offline mode', repo: null, product: { key: 'mobile', name: 'Mobile app' },
            stage: null, created_at: productPrd.created_at, links: { page: `${ORIGIN}/prd/${productPrd.id}`, issue: null },
          },
          {
            id: older.id, ref: '7', number: 7, title: 'Faster invoices', repo: 'northwind/backend', product: { key: 'mobile', name: 'Mobile app' },
            stage: 'building', created_at: older.created_at,
            links: { page: `${ORIGIN}/prd/${older.id}`, issue: 'https://github.com/northwind/backend/issues/7' },
          },
        ],
        next_cursor: null,
      },
    });
    expect(PrdListSchema.parse(page.ok && page.value)).toBeTruthy();
  });

  it('answers no product and no stage when none is known', async () => {
    const api = fakePublicApi();
    api.prd(NORTHWIND, 'northwind/web', 3);
    const page = await publicApiService(api.repository, api.runners).prds(await caller(api, SECRETS.all), FIRST, ORIGIN);
    expect(page.ok && page.value.data[0]).toMatchObject({ ref: '3', product: null, stage: null });
  });

  it('never lists a draft, a bug fix, a visual fix or a concept', async () => {
    const api = fakePublicApi();
    api.add({ workspace: NORTHWIND, kind: 'prd', home_repo: 'northwind/web', numbered: false });
    api.bug(NORTHWIND, 'northwind/web', 9);
    api.add({ workspace: NORTHWIND, kind: 'visual', home_repo: 'northwind/web', prd: parsePrd(10) });
    api.add({ workspace: NORTHWIND, kind: 'concept', home_repo: 'northwind/web', prd: parsePrd(11) });
    const kept = api.prd(NORTHWIND, 'northwind/web', 12);
    const page = await publicApiService(api.repository, api.runners).prds(await caller(api, SECRETS.all), FIRST, ORIGIN);
    expect(page.ok && page.value.data.map((p) => p.id)).toEqual([kept.id]);
  });

  it('lists only the key’s own workspace', async () => {
    const api = fakePublicApi();
    const north = [api.prd(NORTHWIND, 'northwind/backend', 1), api.prd(NORTHWIND, 'northwind/web', 2)];
    const south = [api.prd(SOUTHWIND, 'southwind/backend', 1), api.prd(SOUTHWIND, 'southwind/backend', 2)];
    const service = publicApiService(api.repository, api.runners);
    const ids = async (secret: string) => {
      const page = await service.prds(await caller(api, secret), FIRST, ORIGIN);
      return page.ok ? page.value.data.map((p) => p.id).sort() : [];
    };
    expect(await ids(SECRETS.all)).toEqual(north.map((d) => d.id).sort());
    expect(await ids(SECRETS.south)).toEqual(south.map((d) => d.id).sort());
  });

  it('lists only the allow-list’s repositories, and no product PRD, for a key that has one', async () => {
    const api = fakePublicApi();
    const backend = api.prd(NORTHWIND, 'northwind/backend', 1);
    api.prd(NORTHWIND, 'northwind/web', 2);
    api.add({ workspace: NORTHWIND, kind: 'prd', product_seq: 1, title: 'A product PRD' });
    const page = await publicApiService(api.repository, api.runners).prds(await caller(api, SECRETS.backend), FIRST, ORIGIN);
    expect(page.ok && page.value.data.map((p) => p.id)).toEqual([backend.id]);
  });

  it('names a product PRD whose product is gone by its number alone', async () => {
    const api = fakePublicApi();
    api.add({ workspace: NORTHWIND, kind: 'prd', product_seq: 4, product_id: null });
    const page = await publicApiService(api.repository, api.runners).prds(await caller(api, SECRETS.all), FIRST, ORIGIN);
    expect(page.ok && page.value.data[0]).toMatchObject({ ref: '4', number: 4, product: null, repo: null });
  });
});

describe('the cursor', () => {
  it('pages 120 PRDs by 50, each exactly once, newest first', async () => {
    const api = fakePublicApi();
    for (let n = 1; n <= 120; n += 1) api.prd(NORTHWIND, 'northwind/backend', n);
    const { seen, pages } = await everyPrd(api, await caller(api, SECRETS.all), 50);
    expect(pages).toBe(3);
    expect(seen).toEqual([...api.dossiers].reverse().map((d) => d.id));
  });

  it('never repeats or skips a row while rows are added between pages', async () => {
    const api = fakePublicApi();
    for (let n = 1; n <= 120; n += 1) api.prd(NORTHWIND, 'northwind/backend', n);
    const before = [...api.dossiers].reverse().map((d) => d.id);
    let added = 120;
    const { seen } = await everyPrd(api, await caller(api, SECRETS.all), 50, () => {
      added += 1;
      api.prd(NORTHWIND, 'northwind/backend', added);
    });
    expect(seen).toEqual(before);
    expect(new Set(seen).size).toBe(120);
  });

  it('keeps rows made in the same instant apart by their id', async () => {
    const api = fakePublicApi();
    const at = '2026-10-15T10:00:00.123456+00:00';
    for (let n = 1; n <= 7; n += 1) api.prd(NORTHWIND, 'northwind/backend', n, { created_at: at });
    const { seen } = await everyPrd(api, await caller(api, SECRETS.all), 2);
    expect(seen).toEqual(api.dossiers.map((d) => d.id).sort().reverse());
  });

  it('answers no cursor on the last page, and on an exactly full one', async () => {
    const api = fakePublicApi();
    for (let n = 1; n <= 4; n += 1) api.prd(NORTHWIND, 'northwind/backend', n);
    const service = publicApiService(api.repository, api.runners);
    const key = await caller(api, SECRETS.all);
    const full = await service.prds(key, { limit: 4 }, ORIGIN);
    expect(full.ok && full.value).toMatchObject({ next_cursor: null });
    const partial = await service.prds(key, { limit: 3 }, ORIGIN);
    expect(partial.ok && partial.value.next_cursor).toEqual(expect.any(String));
  });

  it('refuses a cursor that is not this list’s, reading nothing', async () => {
    const api = fakePublicApi();
    const key = await caller(api, SECRETS.all);
    const service = publicApiService(api.repository, api.runners);
    const foreign = encodeCursor({ list: 'bug-fixes', createdAt: '2026-10-15T10:00:00+00:00', id: '00000000-0000-4000-8000-000000000001' });
    for (const cursor of [foreign, 'tampered', `${foreign}x`]) {
      expect(await service.prds(key, { limit: 50, cursor }, ORIGIN)).toEqual({ ok: false, code: 'invalid_request', message: BAD_CURSOR });
    }
    expect(api.calls).toEqual(['keyOf']);
  });
});

describe('the bug-fix list', () => {
  it('answers each bug fix in the spec’s shape, only the key’s workspace and allow-list, newest first', async () => {
    const api = fakePublicApi();
    const first = api.bug(NORTHWIND, 'northwind/backend', 548, { title: 'Login loops' });
    const web = api.bug(NORTHWIND, 'northwind/web', 549);
    api.bug(SOUTHWIND, 'southwind/backend', 1);
    api.prd(NORTHWIND, 'northwind/backend', 550);
    const service = publicApiService(api.repository, api.runners);

    const all = await service.bugFixes(await caller(api, SECRETS.all), FIRST, ORIGIN);
    expect(all.ok && all.value.data.map((b) => b.id)).toEqual([web.id, first.id]);
    expect(all.ok && all.value.data[1]).toEqual({
      id: first.id, number: 548, title: 'Login loops', repo: 'northwind/backend', created_at: first.created_at,
      links: { page: `${ORIGIN}/bugs/${first.id}`, issue: 'https://github.com/northwind/backend/issues/548' },
    });
    expect(BugFixListSchema.parse(all.ok && all.value)).toBeTruthy();

    const limited = await service.bugFixes(await caller(api, SECRETS.backend), FIRST, ORIGIN);
    expect(limited.ok && limited.value.data.map((b) => b.id)).toEqual([first.id]);
  });

  it('pages by its own cursor, and refuses the PRD list’s', async () => {
    const api = fakePublicApi();
    for (let n = 1; n <= 5; n += 1) api.bug(NORTHWIND, 'northwind/backend', n);
    const service = publicApiService(api.repository, api.runners);
    const key = await caller(api, SECRETS.all);
    const first = await service.bugFixes(key, { limit: 3 }, ORIGIN);
    const cursor = first.ok ? first.value.next_cursor ?? '' : '';
    const second = await service.bugFixes(key, { limit: 3, cursor }, ORIGIN);
    expect(second.ok && second.value).toMatchObject({ next_cursor: null });
    expect(second.ok && second.value.data.map((b) => b.number)).toEqual([2, 1]);
    expect(await service.prds(key, { limit: 3, cursor }, ORIGIN)).toMatchObject({ ok: false, code: 'invalid_request' });
  });
});

describe('starting a bug fix (PRD 2022 s4)', () => {
  const FIX = { repo: 'Demo-Org/App', description: 'Issue 548 totals' };

  it('builds the line, sends as the key, and keeps the allow-list in front of the runners', async () => {
    const api = fakePublicApi();
    const service = publicApiService(api.repository, api.runners);
    const all = await caller(api, SECRETS.runners);
    const started = await service.startBugFix(all, FIX);
    expect(started).toMatchObject({ ok: true, value: { status: 'queued', repo: 'demo-org/app', line: '/omni:bug-fix Issue 548 totals' } });
    expect(api.runnersState.jobs).toHaveLength(1);

    const limited = await caller(api, SECRETS.runnersLimited);
    expect(await service.startBugFix(limited, FIX)).toMatchObject({ ok: false, code: 'forbidden' });
    expect(await service.startBugFix(limited, { ...FIX, repo: 'demo-org/other' })).toMatchObject({ ok: true });
    expect(api.runnersState.jobs).toHaveLength(2);
  });

  it('answers the runners’ own reason for a line they refuse, as 422 on the description', async () => {
    const api = fakePublicApi();
    const service = publicApiService(api.repository, api.runners);
    const refused = await service.startBugFix(await caller(api, SECRETS.runners), { ...FIX, description: 'a; b' });
    expect(refused).toMatchObject({ ok: false, code: 'invalid_request' });
    expect(!refused.ok && refused.message).toMatch(/^description: .*arguments/);
  });

  it('follows only a job a key of its workspace queued', async () => {
    const api = fakePublicApi();
    const service = publicApiService(api.repository, api.runners);
    const mine = await caller(api, SECRETS.runners);
    const started = await service.startBugFix(mine, FIX);
    const id = started.ok ? started.value.id : '';
    expect(await service.job(mine, id)).toMatchObject({ ok: true, value: { id, status: 'queued' } });
    expect(await service.job(await caller(api, SECRETS.all), id)).toMatchObject({ ok: false, code: 'not_found' });
  });

  it(`queues only a line the runner itself runs: ${String(DESCRIPTION_MAX)} characters make a line of ${String(LINE_MAX)}`, async () => {
    const api = fakePublicApi();
    const started = await publicApiService(api.repository, api.runners).startBugFix(await caller(api, SECRETS.runners), { ...FIX, description: 'a'.repeat(DESCRIPTION_MAX) });
    const line = started.ok ? started.value.line : '';
    expect(line).toHaveLength(LINE_MAX);
    expect(checkRunnerLine(line)).toMatchObject({ ok: true, skill: 'bug-fix' });
    expect(checkRunnerLine(`${line}a`)).toMatchObject({ ok: false, reason: `the line is over ${String(LINE_MAX)} characters` });
  });
});

describe('starting a mega bug fix in a plan repository', () => {
  const ISSUE = 'https://github.com/demo-org/plan/issues/612';
  const FIX = { repo: 'Demo-Org/Plan', description: ISSUE };

  it('builds the /omni:mega-bug-fix line in the plan repository and sends it as the key', async () => {
    const api = fakePublicApi();
    api.planRepository(WORKSPACE, 'demo-org/plan');
    const started = await publicApiService(api.repository, api.runners).startMegaBugFix(await caller(api, SECRETS.runners), FIX);
    expect(started).toMatchObject({ ok: true, value: { status: 'queued', repo: 'demo-org/plan', line: `/omni:mega-bug-fix ${ISSUE}` } });
    expect(api.runnersState.jobs).toHaveLength(1);
  });

  it('refuses a repository no product of the key’s workspace names as its plan repository, queueing nothing', async () => {
    const api = fakePublicApi();
    api.planRepository(NORTHWIND, 'demo-org/plan');
    const service = publicApiService(api.repository, api.runners);
    const key = await caller(api, SECRETS.runners);
    for (const repo of ['demo-org/plan', 'demo-org/app']) {
      const refused = await service.startMegaBugFix(key, { ...FIX, repo });
      expect(refused).toMatchObject({ ok: false, code: 'invalid_request' });
      expect(!refused.ok && refused.message).toBe(`repo: ${repo} is not a plan repository of this workspace: no product names it as its plan repository. A bug of one repository starts with POST /api/v1/bug-fixes.`);
    }
    expect(api.runnersState.jobs).toEqual([]);
  });

  it('keeps the allow-list in front of the plan check and the runners', async () => {
    const api = fakePublicApi();
    api.planRepository(WORKSPACE, 'demo-org/plan');
    api.planRepository(WORKSPACE, 'demo-org/other');
    const service = publicApiService(api.repository, api.runners);
    const limited = await caller(api, SECRETS.runnersLimited);
    api.calls.length = 0;
    expect(await service.startMegaBugFix(limited, FIX)).toMatchObject({ ok: false, code: 'forbidden', message: 'demo-org/plan is not on this API key’s list of repositories.' });
    expect(api.calls).toEqual([]);
    expect(await service.startMegaBugFix(limited, { ...FIX, repo: 'demo-org/other' })).toMatchObject({ ok: true, value: { repo: 'demo-org/other' } });
    expect(api.runnersState.jobs).toHaveLength(1);
  });

  it('answers the runners’ own refusal, as for a bug fix', async () => {
    const api = fakePublicApi();
    api.planRepository(WORKSPACE, 'demo-org/plan');
    const refused = await publicApiService(api.repository, api.runners).startMegaBugFix(await caller(api, SECRETS.runners), { ...FIX, runner: 'ghost' });
    expect(refused).toMatchObject({ ok: false, code: 'invalid_request', message: 'runner or fleet: No runner named ghost in this workspace.' });
  });

  it(`queues only a line the runner itself runs: ${String(MEGA_DESCRIPTION_MAX)} characters make a line of ${String(LINE_MAX)}`, async () => {
    const api = fakePublicApi();
    api.planRepository(WORKSPACE, 'demo-org/plan');
    const started = await publicApiService(api.repository, api.runners).startMegaBugFix(await caller(api, SECRETS.runners), { ...FIX, description: 'a'.repeat(MEGA_DESCRIPTION_MAX) });
    const line = started.ok ? started.value.line : '';
    expect(line).toHaveLength(LINE_MAX);
    expect(checkRunnerLine(line)).toMatchObject({ ok: true, skill: 'mega-bug-fix' });
    expect(checkRunnerLine(`${line}a`)).toMatchObject({ ok: false });
  });
});

// PRD 2425 s3: a key reads, with its job, what a bug fix did; any key of the workspace reads any job a key of it sent,
// within its own list of repositories.
describe('following a job and what it did (PRD 2425 s3)', () => {
  type Seed = Partial<ReturnType<typeof jobRow>>;
  const PR = 'https://github.com/demo-org/app/pull/549';
  const SECOND = 'https://github.com/demo-org/app/pull/550';
  const PROVED = 'https://github.com/demo-org/app/pull/512';
  const PUBLIC_WORDS = [
    ['pr-opened', 'pr_opened'], ['already-fixed', 'already_fixed'], ['needs-brainstorm', 'needs_brainstorm'],
    ['not-a-bug', 'not_a_bug'], ['stuck', 'stuck'], ['blocked', 'blocked'], ['human', 'need_human'],
  ] as const;

  /** A bug fix the first key of the workspace sent, ended `done` on the shared runner, in demo-org/app. */
  function seed(api: FakePublicApi, more: Seed = {}) {
    const job = jobRow({
      status: 'done', runner_id: SHARED, line: '/omni:bug-fix 548 totals', sent_by: OLGA, sent_by_key: API_KEY, exit_code: 0,
      claimed_at: T0.toISOString(), running_at: T0.toISOString(), ended_at: T0.toISOString(), ...more,
    });
    api.runnersState.jobs.push(job);
    return job;
  }
  async function read(api: FakePublicApi, secret: string, id: string) {
    return publicApiService(api.repository, api.runners).job(await caller(api, secret), id);
  }
  const valueOf = <T>(answered: { ok: true; value: T } | { ok: false; message: string }): T => {
    if (!answered.ok) throw new Error(answered.message);
    return answered.value;
  };

  describe('what the job did', () => {
    it('reads already_fixed with the pull request the fix proved, and no pull request of its own', async () => {
      const api = fakePublicApi();
      const job = seed(api, { outcome: 'already-fixed', fixed_by: PROVED, prs: [] });
      expect(valueOf(await read(api, SECRETS.runners, job.id))).toMatchObject({
        status: 'done', outcome: 'already_fixed', fixed_by: PROVED, prs: [], pr_url: null,
      });
    });

    it.each(PUBLIC_WORDS)('reads the stored word %s as %s', async (stored, word) => {
      const api = fakePublicApi();
      const job = seed(api, { outcome: stored });
      expect(valueOf(await read(api, SECRETS.runners, job.id)).outcome).toBe(word);
    });

    it('reads need_human with its questions open', async () => {
      const api = fakePublicApi();
      const job = seed(api, { outcome: 'human' });
      api.runnersState.questions.push(questionsRow({ job_id: job.id }));
      expect(valueOf(await read(api, SECRETS.runners, job.id))).toMatchObject({ outcome: 'need_human', questions: { state: 'open' } });
    });

    it('reads pr_opened with the pull request in prs, as a link, its repository and its number', async () => {
      const api = fakePublicApi();
      const job = seed(api, { outcome: 'pr-opened', pr_url: PR, prs: [PR] });
      expect(valueOf(await read(api, SECRETS.runners, job.id))).toMatchObject({
        pr_url: PR, prs: [{ url: PR, repo: 'demo-org/app', number: 549 }],
      });
    });

    it('reads the repository of a pull request in lower case, as the allow-lists and the PRD lists name it', async () => {
      const api = fakePublicApi();
      const job = seed(api, { outcome: 'pr-opened', prs: ['https://github.com/Demo-Org/Plan/pull/7'] });
      expect(valueOf(await read(api, SECRETS.runners, job.id)).prs).toEqual([{ url: 'https://github.com/Demo-Org/Plan/pull/7', repo: 'demo-org/plan', number: 7 }]);
    });

    it('reads stuck with its draft in prs', async () => {
      const api = fakePublicApi();
      const job = seed(api, { outcome: 'stuck', prs: [PR] });
      expect(valueOf(await read(api, SECRETS.runners, job.id))).toMatchObject({ outcome: 'stuck', prs: [{ number: 549 }] });
    });

    it('reads a failed job with no outcome and its draft in prs', async () => {
      const api = fakePublicApi();
      const job = seed(api, { status: 'failed', exit_code: 1, reason: 'the run exited 1', prs: [PR] });
      expect(valueOf(await read(api, SECRETS.runners, job.id))).toMatchObject({ status: 'failed', outcome: null, fixed_by: null, prs: [{ url: PR }] });
    });

    it('reads a job from an older runner, which reported none of it, as outcome null with no pull request', async () => {
      const api = fakePublicApi();
      const job = seed(api, { pr_url: PR });
      expect(valueOf(await read(api, SECRETS.runners, job.id))).toMatchObject({ status: 'done', outcome: null, fixed_by: null, prs: [], questions: null, pr_url: PR });
    });

    it('reads a running job with no outcome yet', async () => {
      const api = fakePublicApi();
      const job = seed(api, { status: 'running', exit_code: null, ended_at: null });
      expect(valueOf(await read(api, SECRETS.runners, job.id))).toMatchObject({ status: 'running', outcome: null });
    });

    it('lists the three pull requests of a mega bug fix with its record last, and keeps pr_url as the record', async () => {
      const api = fakePublicApi();
      const record = 'https://github.com/demo-org/plan/pull/9';
      const job = seed(api, { repo: 'demo-org/plan', line: '/omni:mega-bug-fix 612', outcome: 'pr-opened', pr_url: record, prs: [PR, 'https://github.com/demo-org/other/pull/3', record] });
      const mega = valueOf(await read(api, SECRETS.runners, job.id));
      expect(mega.prs.map((pr) => pr.number)).toEqual([549, 3, 9]);
      expect(mega.prs.map((pr) => pr.repo)).toEqual(['demo-org/app', 'demo-org/other', 'demo-org/plan']);
      expect(mega.pr_url).toBe(record);
    });

    it('keeps the order the runner reported the pull requests in', async () => {
      const api = fakePublicApi();
      const job = seed(api, { outcome: 'pr-opened', prs: [SECOND, PR] });
      expect(valueOf(await read(api, SECRETS.runners, job.id)).prs.map((pr) => pr.number)).toEqual([550, 549]);
    });

    it('reads the proved pull request of an already_fixed job only: another job’s fixed_by stays null', async () => {
      const api = fakePublicApi();
      const job = seed(api, { outcome: 'pr-opened', fixed_by: PROVED });
      expect(valueOf(await read(api, SECRETS.runners, job.id)).fixed_by).toBeNull();
    });

    it('reads the log tail, and null when the job holds none', async () => {
      const api = fakePublicApi();
      const tail = seed(api, { log_tail: '12:00:01 Outcome: pr-opened' });
      const none = seed(api, { log_tail: '' });
      expect(valueOf(await read(api, SECRETS.runners, tail.id)).log_tail).toBe('12:00:01 Outcome: pr-opened');
      expect(valueOf(await read(api, SECRETS.runners, none.id)).log_tail).toBeNull();
    });

    it('reads the state of the questions, open, answered or dismissed, and none as null', async () => {
      const api = fakePublicApi();
      const open = seed(api, { outcome: 'human' });
      const answered = seed(api, { outcome: 'human' });
      const dismissed = seed(api, { outcome: 'human' });
      const none = seed(api);
      const closed = { closed_by: OLGA, closed_at: T0.toISOString() };
      api.runnersState.questions.push(
        questionsRow({ job_id: open.id }),
        questionsRow({ job_id: answered.id, ...closed, answers: { 'Which fix?': 'Guard the input' } }),
        questionsRow({ job_id: dismissed.id, ...closed }),
      );
      const states = await Promise.all([open, answered, dismissed, none].map(async (job) => valueOf(await read(api, SECRETS.runners, job.id)).questions));
      expect(states).toEqual([{ state: 'open' }, { state: 'answered' }, { state: 'dismissed' }, null]);
    });
  });

  describe('who it continues and who it acted for', () => {
    it('reads the job it continues and the job that continues it, each from the other', async () => {
      const api = fakePublicApi();
      const first = seed(api, { outcome: 'human' });
      const second = seed(api, { status: 'queued', exit_code: null, ended_at: null, continues: first.id, acting_for: 'Jane D.' });
      expect(valueOf(await read(api, SECRETS.runners, first.id))).toMatchObject({ continues: null, continued_by: second.id });
      expect(valueOf(await read(api, SECRETS.runnersOther, second.id))).toMatchObject({ continues: first.id, continued_by: null, acting_for: 'Jane D.' });
    });

    it('reads a job that continues nothing, and acted for no one, with nulls', async () => {
      const api = fakePublicApi();
      const job = seed(api);
      expect(valueOf(await read(api, SECRETS.runners, job.id))).toMatchObject({ continues: null, continued_by: null, acting_for: null, cancelled_by: null });
    });

    it('reads the key that cancelled the job by its name, and whom it acted for', async () => {
      const api = fakePublicApi();
      const job = seed(api, { status: 'cancelled', exit_code: null, cancel_requested: true, cancelled_by_key: OTHER_KEY, cancelled_for: 'Jane D.' });
      expect(valueOf(await read(api, SECRETS.runners, job.id))).toMatchObject({ status: 'cancelled', outcome: null, cancelled_by: { key: 'Support bot', acting_for: 'Jane D.' } });
    });

    it('reads a cancellation by a key that acted for no one with acting_for null', async () => {
      const api = fakePublicApi();
      const job = seed(api, { status: 'cancelled', exit_code: null, cancel_requested: true, cancelled_by_key: API_KEY });
      expect(valueOf(await read(api, SECRETS.runners, job.id)).cancelled_by).toEqual({ key: 'QA dashboard', acting_for: null });
    });
  });

  describe('which jobs a key reads', () => {
    it('lets a second key of the workspace read the first key’s job', async () => {
      const api = fakePublicApi();
      const job = seed(api, { outcome: 'pr-opened', prs: [PR] });
      expect(await read(api, SECRETS.runnersOther, job.id)).toMatchObject({ ok: true, value: { id: job.id, outcome: 'pr_opened' } });
    });

    it('answers 403 to a key whose list leaves the job’s repository out, and reads a job of one on it', async () => {
      const api = fakePublicApi();
      const off = seed(api);
      const on = seed(api, { repo: 'demo-org/other' });
      const refused = await read(api, SECRETS.runnersLimited, off.id);
      expect(refused).toMatchObject({ ok: false, code: 'forbidden' });
      expect(!refused.ok && refused.message).toBe('demo-org/app is not on this API key’s list of repositories.');
      expect(await read(api, SECRETS.runnersLimited, on.id)).toMatchObject({ ok: true, value: { id: on.id, repo: 'demo-org/other' } });
    });

    it('answers 404 for a job a person sent, whatever the key’s list', async () => {
      const api = fakePublicApi();
      const job = seed(api, { sent_by_key: null });
      for (const secret of [SECRETS.runners, SECRETS.runnersOther, SECRETS.runnersLimited]) {
        expect(await read(api, secret, job.id), secret).toMatchObject({ ok: false, code: 'not_found' });
      }
    });

    it('answers 404 for another workspace’s job, a limited key included, and never 403', async () => {
      const api = fakePublicApi();
      const job = seed(api);
      for (const secret of [SECRETS.all, SECRETS.backend, SECRETS.south]) {
        expect(await read(api, secret, job.id), secret).toMatchObject({ ok: false, code: 'not_found' });
      }
    });

    it('answers 404 for a job that does not exist', async () => {
      const api = fakePublicApi();
      expect(await read(api, SECRETS.runners, '00000000-0000-4000-8000-00000000dead')).toMatchObject({ ok: false, code: 'not_found' });
    });
  });

  describe('the job a key has just sent', () => {
    it('reads queued with nothing done yet: no outcome, no pull request, no questions, no thread', async () => {
      const api = fakePublicApi();
      const started = await publicApiService(api.repository, api.runners).startBugFix(await caller(api, SECRETS.runners), { repo: 'demo-org/app', description: 'Issue 548 totals' });
      expect(valueOf(started)).toMatchObject({
        status: 'queued', outcome: null, fixed_by: null, prs: [], questions: null, continues: null, continued_by: null,
        acting_for: null, cancelled_by: null, log_tail: null,
      });
    });

    it('reads the same shape when the job is a mega bug fix', async () => {
      const api = fakePublicApi();
      api.planRepository(WORKSPACE, 'demo-org/plan');
      const started = await publicApiService(api.repository, api.runners).startMegaBugFix(await caller(api, SECRETS.runners), { repo: 'demo-org/plan', description: 'https://github.com/demo-org/plan/issues/612' });
      expect(valueOf(started)).toMatchObject({ outcome: null, prs: [], questions: null, cancelled_by: null });
    });
  });
});

describe('reading a job’s lines (PRD 2425 s4)', () => {
  const MISSING = '00000000-0000-4000-8000-00000000dead';

  /** A bug fix the first key of the workspace sent, ended `done` on the shared runner, in demo-org/app, holding `count` lines. */
  function seed(api: FakePublicApi, count: number, more: Partial<ReturnType<typeof jobRow>> = {}) {
    const job = jobRow({
      status: 'done', runner_id: SHARED, line: '/omni:bug-fix 548 totals', sent_by: OLGA, sent_by_key: API_KEY, exit_code: 0,
      claimed_at: T0.toISOString(), running_at: T0.toISOString(), ended_at: T0.toISOString(), ...more,
    });
    api.runnersState.jobs.push(job);
    api.runnersState.lines.push(...lineRows(job, 1, count));
    return job;
  }
  async function read(api: FakePublicApi, secret: string, id: string, query: ListQuery = FIRST) {
    return publicApiService(api.repository, api.runners).jobLines(await caller(api, secret), id, query);
  }
  const valueOf = <T>(answered: { ok: true; value: T } | { ok: false; message: string }): T => {
    if (!answered.ok) throw new Error(answered.message);
    return answered.value;
  };
  /** Every line of a job, following next_cursor until it is null, with `between` run before each next page. */
  async function everyLine(api: FakePublicApi, secret: string, id: string, limit: number, between: () => void = () => {}) {
    const seen: number[] = [];
    let cursor: string | undefined;
    for (let pages = 0; pages < 20; pages += 1) {
      const page = valueOf(await read(api, secret, id, cursor === undefined ? { limit } : { limit, cursor }));
      expect(page.data.length).toBeLessThanOrEqual(limit);
      seen.push(...page.data.map((line) => line.seq));
      if (page.next_cursor === null) return { seen, pages: pages + 1 };
      cursor = page.next_cursor;
      between();
    }
    throw new Error('the cursor never ended');
  }

  describe('the lines', () => {
    it('answers each line as its sequence number and its text, oldest first, and no cursor after the last', async () => {
      const api = fakePublicApi();
      const job = seed(api, 3);
      api.runnersState.lines.reverse();
      expect(valueOf(await read(api, SECRETS.runners, job.id))).toEqual({
        data: [{ seq: 1, text: 'line 1' }, { seq: 2, text: 'line 2' }, { seq: 3, text: 'line 3' }], next_cursor: null,
      });
    });

    it('pages 120 lines by 50, each exactly once, oldest first', async () => {
      const api = fakePublicApi();
      const job = seed(api, 120);
      const { seen, pages } = await everyLine(api, SECRETS.runners, job.id, 50);
      expect(seen).toEqual([...Array(120).keys()].map((i) => i + 1));
      expect(pages).toBe(3);
    });

    it('pages by the limit it was asked, 1 line at a time too', async () => {
      const api = fakePublicApi();
      const job = seed(api, 4);
      expect((await everyLine(api, SECRETS.runners, job.id, 1)).seen).toEqual([1, 2, 3, 4]);
      expect(valueOf(await read(api, SECRETS.runners, job.id, { limit: 100 })).data).toHaveLength(4);
    });

    it('answers no cursor on the last page, and on an exactly full one', async () => {
      const api = fakePublicApi();
      const exact = seed(api, 50);
      const more = seed(api, 51);
      expect(valueOf(await read(api, SECRETS.runners, exact.id)).next_cursor).toBeNull();
      const first = valueOf(await read(api, SECRETS.runners, more.id));
      expect(first.data).toHaveLength(50);
      expect(first.next_cursor).toEqual(expect.any(String));
      expect(valueOf(await read(api, SECRETS.runners, more.id, { limit: 50, cursor: first.next_cursor ?? '' }))).toEqual({
        data: [{ seq: 51, text: 'line 51' }], next_cursor: null,
      });
    });

    it('reads on from lines that arrive between two pages without repeating or skipping one', async () => {
      const api = fakePublicApi();
      const job = seed(api, 120, { status: 'running', ended_at: null, exit_code: null });
      let next = 121;
      const { seen } = await everyLine(api, SECRETS.runners, job.id, 50, () => {
        api.runnersState.lines.push(...lineRows(job, next, 10));
        next += 10;
      });
      expect(seen).toEqual([...Array(seen.length).keys()].map((i) => i + 1));
      expect(seen.length).toBeGreaterThan(120);
    });

    it('starts at the first line a job still holds when its first ones were trimmed', async () => {
      const api = fakePublicApi();
      const job = jobRow({ status: 'running', runner_id: SHARED, sent_by: OLGA, sent_by_key: API_KEY });
      api.runnersState.jobs.push(job);
      api.runnersState.lines.push(...lineRows(job, 9_001, 3));
      expect(valueOf(await read(api, SECRETS.runners, job.id)).data.map((line) => line.seq)).toEqual([9_001, 9_002, 9_003]);
    });

    it('answers only the job’s own lines when the workspace holds others', async () => {
      const api = fakePublicApi();
      const job = seed(api, 2);
      seed(api, 5);
      expect((await everyLine(api, SECRETS.runners, job.id, 50)).seen).toEqual([1, 2]);
    });

    it('answers an empty page for a job that holds none: queued, or past the retention of the workspace’s 50 newest ended jobs, which keeps its log tail', async () => {
      const api = fakePublicApi();
      const queued = seed(api, 0, { status: 'queued', runner_id: null, ended_at: null, exit_code: null, claimed_at: null, running_at: null });
      const old = seed(api, 0, { log_tail: '13:49:58 PR: https://github.com/demo-org/app/pull/549' });
      for (const job of [queued, old]) expect(valueOf(await read(api, SECRETS.runners, job.id))).toEqual({ data: [], next_cursor: null });
      const service = publicApiService(api.repository, api.runners);
      expect(valueOf(await service.job(await caller(api, SECRETS.runners), old.id)).log_tail).toBe('13:49:58 PR: https://github.com/demo-org/app/pull/549');
    });
  });

  describe('which jobs a key reads the lines of', () => {
    it('lets a second key of the workspace read the first key’s lines', async () => {
      const api = fakePublicApi();
      const job = seed(api, 2);
      expect(valueOf(await read(api, SECRETS.runnersOther, job.id)).data).toHaveLength(2);
    });

    it('answers 403 to a key whose list leaves the job’s repository out, reading no line, and reads a job of one on it', async () => {
      const api = fakePublicApi();
      const off = seed(api, 2);
      const on = seed(api, 2, { repo: 'demo-org/other' });
      const refused = await read(api, SECRETS.runnersLimited, off.id);
      expect(refused).toMatchObject({ ok: false, code: 'forbidden' });
      expect(!refused.ok && refused.message).toBe('demo-org/app is not on this API key’s list of repositories.');
      expect(api.calls).not.toContain('jobLines');
      expect(valueOf(await read(api, SECRETS.runnersLimited, on.id)).data).toHaveLength(2);
    });

    it('answers 404 for a job a person sent, whatever the key’s list, reading no line', async () => {
      const api = fakePublicApi();
      const job = seed(api, 2, { sent_by_key: null });
      for (const secret of [SECRETS.runners, SECRETS.runnersOther, SECRETS.runnersLimited]) {
        expect(await read(api, secret, job.id), secret).toMatchObject({ ok: false, code: 'not_found', message: 'No such job.' });
      }
      expect(api.calls).not.toContain('jobLines');
    });

    it('answers 404 for another workspace’s job, a limited key included, and never 403, reading no line', async () => {
      const api = fakePublicApi();
      const job = seed(api, 2);
      for (const secret of [SECRETS.all, SECRETS.backend, SECRETS.south]) {
        expect(await read(api, secret, job.id), secret).toMatchObject({ ok: false, code: 'not_found' });
      }
      expect(api.calls).not.toContain('jobLines');
    });

    it('answers 404 for a job that does not exist', async () => {
      const api = fakePublicApi();
      expect(await read(api, SECRETS.runners, MISSING)).toMatchObject({ ok: false, code: 'not_found' });
      expect(api.calls).not.toContain('jobLines');
    });
  });

  describe('the cursor', () => {
    it('refuses a cursor that is not this job’s lines, as 422 naming the cursor, reading no line', async () => {
      const api = fakePublicApi();
      const job = seed(api, 5);
      const other = seed(api, 5);
      const refusals = [
        'not a cursor',
        encodeCursor({ list: 'prds', createdAt: '2026-10-15T13:41:50.481234+00:00', id: job.id }),
        encodeLinesCursor({ job: other.id, seq: 2 }),
      ];
      for (const cursor of refusals) {
        const refused = await read(api, SECRETS.runners, job.id, { limit: 50, cursor });
        expect(refused, cursor).toEqual({ ok: false, code: 'invalid_request', message: BAD_CURSOR });
      }
      expect(api.calls).not.toContain('jobLines');
    });

    it('checks the job before the cursor: a job of another workspace is 404 whatever the cursor', async () => {
      const api = fakePublicApi();
      const job = seed(api, 5);
      expect(await read(api, SECRETS.south, job.id, { limit: 50, cursor: 'not a cursor' })).toMatchObject({ ok: false, code: 'not_found' });
    });

    it('answers lines after the cursor’s sequence number', async () => {
      const api = fakePublicApi();
      const job = seed(api, 5);
      const page = valueOf(await read(api, SECRETS.runners, job.id, { limit: 2, cursor: encodeLinesCursor({ job: job.id, seq: 2 }) }));
      expect(page.data.map((line) => line.seq)).toEqual([3, 4]);
      expect(page.next_cursor).toEqual(expect.any(String));
    });
  });

  it('fails, rather than answering 404, when the runners fail: the controller answers 500', async () => {
    const api = fakePublicApi();
    const job = seed(api, 2);
    const broken = { ...api.runners, keyJob: () => Promise.resolve({ ok: false as const, kind: 'unavailable' as const, error: 'runner_jobs: permission denied' }) };
    const service = publicApiService(api.repository, broken);
    await expect(service.jobLines(await caller(api, SECRETS.runners), job.id, FIRST)).rejects.toThrow('runner_jobs: permission denied');
  });
});

// PRD 2425 s6: a key reads the questions of a job a key of its workspace sent, answers them (the resume stays the
// key's and continues the job) or dismisses them with no job queued; the first close wins, whoever closes.
describe('a key answering and dismissing its job’s questions (PRD 2425 s6)', () => {
  const ANSWERS = { 'Which fix?': 'Guard the input' };
  const UNKNOWN_JOB = '00000000-0000-4000-8000-00000000dead';

  /** A bug fix the first key of the workspace sent, ended `done` with its questions open, in demo-org/app. */
  function seed(api: FakePublicApi, more: Partial<ReturnType<typeof jobRow>> = {}, asked = true) {
    const job = jobRow({
      status: 'done', outcome: 'human', runner_id: SHARED, line: '/omni:bug-fix #314', sent_by: OLGA, sent_by_key: API_KEY, exit_code: 0,
      claimed_at: T0.toISOString(), running_at: T0.toISOString(), ended_at: T0.toISOString(), ...more,
    });
    api.runnersState.jobs.push(job);
    if (asked) api.runnersState.questions.push(questionsRow({ job_id: job.id }));
    return job;
  }
  const service = (api: FakePublicApi) => publicApiService(api.repository, api.runners);
  const valueOf = <T>(answered: { ok: true; value: T } | { ok: false; message: string }): T => {
    if (!answered.ok) throw new Error(answered.message);
    return answered.value;
  };

  describe('reading the questions', () => {
    it('reads an open round in the API’s words: the lead, the questions, no answers and nobody who closed it', async () => {
      const api = fakePublicApi();
      const job = seed(api);
      const read = valueOf(await service(api).jobQuestions(await caller(api, SECRETS.runnersOther), job.id));
      expect(read).toEqual({
        lead: 'The planning query fails for 31 tenants.',
        questions: [{
          question: 'Which fix?', header: 'Fix', multi_select: false,
          options: [{ label: 'Guard the input', description: 'Check the tenant before the query' }, { label: 'Design it first', description: 'Stop here and brainstorm the behaviour' }],
        }],
        state: 'open', answers: null, closed_by: null,
      });
    });

    it('reads who closed a round: a key by its name and whom it acted for, or a person by their login', async () => {
      const api = fakePublicApi();
      const [byKey, byPerson, noLogin, dismissed, gone] = [seed(api, {}, false), seed(api, {}, false), seed(api, {}, false), seed(api, {}, false), seed(api, {}, false)];
      const closed_at = T0.toISOString();
      api.runnersState.questions.push(
        questionsRow({ job_id: byKey.id, answers: ANSWERS, closed_by_key: OTHER_KEY, closed_for: 'Jane D.', closed_at }),
        questionsRow({ job_id: byPerson.id, answers: ANSWERS, closed_by: OLGA, closed_at }),
        questionsRow({ job_id: noLogin.id, answers: ANSWERS, closed_by: SAM, closed_at }),
        questionsRow({ job_id: dismissed.id, closed_by_key: API_KEY, closed_at }),
        // A key that was deleted since: the database leaves no closer on the round.
        questionsRow({ job_id: gone.id, closed_at }),
      );
      const key = await caller(api, SECRETS.runners);
      expect(valueOf(await service(api).jobQuestions(key, byKey.id))).toMatchObject({ state: 'answered', answers: ANSWERS, closed_by: { key: 'Support bot', acting_for: 'Jane D.' } });
      expect(valueOf(await service(api).jobQuestions(key, byPerson.id))).toMatchObject({ state: 'answered', answers: ANSWERS, closed_by: { login: 'olga' } });
      expect(valueOf(await service(api).jobQuestions(key, noLogin.id))).toMatchObject({ state: 'answered', closed_by: { login: null } });
      expect(valueOf(await service(api).jobQuestions(key, dismissed.id))).toMatchObject({ state: 'dismissed', answers: null, closed_by: { key: 'QA dashboard', acting_for: null } });
      expect(valueOf(await service(api).jobQuestions(key, gone.id))).toMatchObject({ state: 'dismissed', answers: null, closed_by: null });
    });

    it('answers 404 for a job that asked none, in its own words, and for a person’s job, another workspace’s and none at all', async () => {
      const api = fakePublicApi();
      const quiet = seed(api, {}, false);
      const person = seed(api, { sent_by_key: null });
      const key = await caller(api, SECRETS.runners);
      expect(await service(api).jobQuestions(key, quiet.id)).toEqual({ ok: false, code: 'not_found', message: 'This job asked no question.' });
      expect(await service(api).jobQuestions(key, person.id)).toMatchObject({ ok: false, code: 'not_found', message: 'No such job.' });
      expect(await service(api).jobQuestions(key, UNKNOWN_JOB)).toMatchObject({ ok: false, code: 'not_found' });
      expect(await service(api).jobQuestions(await caller(api, SECRETS.south), quiet.id)).toMatchObject({ ok: false, code: 'not_found', message: 'No such job.' });
    });

    it('answers 403 to a key whose list leaves the job’s repository out, and reads a job of one on it', async () => {
      const api = fakePublicApi();
      const off = seed(api);
      const on = seed(api, { repo: 'demo-org/other' });
      const limited = await caller(api, SECRETS.runnersLimited);
      expect(await service(api).jobQuestions(limited, off.id)).toEqual({ ok: false, code: 'forbidden', message: 'demo-org/app is not on this API key’s list of repositories.' });
      expect(await service(api).jobQuestions(limited, on.id)).toMatchObject({ ok: true, value: { state: 'open' } });
    });
  });

  describe('answering', () => {
    it('queues the resume as the job’s key, continuing the job, and answers it as a job: queued, acting_for, no questions yet', async () => {
      const api = fakePublicApi();
      const job = seed(api);
      const resume = valueOf(await service(api).answerJob(await caller(api, SECRETS.runnersOther), job.id, { answers: ANSWERS, acting_for: 'Jane D.' }));
      expect(resume).toMatchObject({
        line: `/omni:bug-fix #314 --answers ${job.id}`, repo: 'demo-org/app', status: 'queued', continues: job.id, continued_by: null,
        acting_for: 'Jane D.', questions: null, outcome: null, prs: [],
      });
      // The key that answered is not the key that sent the job: the resume stays the sender’s.
      expect(api.runnersState.jobs.find((j) => j.id === resume.id)).toMatchObject({ sent_by: OLGA, sent_by_key: API_KEY, continues: job.id });
    });

    it('reads the first job as carried on by the resume and answered, and the resume by the key that sent the job', async () => {
      const api = fakePublicApi();
      const job = seed(api);
      const resume = valueOf(await service(api).answerJob(await caller(api, SECRETS.runnersOther), job.id, { answers: ANSWERS }));
      const sender = await caller(api, SECRETS.runners);
      expect(valueOf(await service(api).job(sender, job.id))).toMatchObject({ continued_by: resume.id, questions: { state: 'answered' } });
      expect(valueOf(await service(api).job(sender, resume.id))).toMatchObject({ id: resume.id, continues: job.id });
      expect(valueOf(await service(api).jobQuestions(sender, job.id))).toMatchObject({ state: 'answered', answers: ANSWERS, closed_by: { key: 'Support bot', acting_for: null } });
    });

    it('stores whom the key acted for as given, and no one when it said none', async () => {
      const api = fakePublicApi();
      const [named, anonymous] = [seed(api), seed(api)];
      const key = await caller(api, SECRETS.runnersOther);
      await service(api).answerJob(key, named.id, { answers: ANSWERS, acting_for: '  José O\'Neil · ops  ' });
      await service(api).answerJob(key, anonymous.id, { answers: ANSWERS });
      const closed = new Map(api.runnersState.questions.map((q) => [q.job_id, q.closed_for]));
      expect(closed.get(named.id)).toBe('  José O\'Neil · ops  ');
      expect(closed.get(anonymous.id)).toBeNull();
    });

    it('answers 409 conflict to a second answer or dismissal, from a key or the page, naming the first: the first wins', async () => {
      const api = fakePublicApi();
      const job = seed(api);
      const key = await caller(api, SECRETS.runnersOther);
      valueOf(await service(api).answerJob(key, job.id, { answers: ANSWERS }));
      const closed = { ok: false, code: 'conflict', message: 'Already answered by API key Support bot' };
      expect(await service(api).answerJob(await caller(api, SECRETS.runners), job.id, { answers: ANSWERS })).toEqual(closed);
      expect(await service(api).dismissJob(key, job.id, {})).toEqual(closed);
      expect(await api.runners.answer(OLGA, job.id, { answers: ANSWERS })).toEqual({ ok: false, kind: 'conflict', error: 'Already answered by API key Support bot' });
      expect(api.runnersState.jobs.filter((j) => j.continues === job.id)).toHaveLength(1);
    });

    it('answers 409 conflict to a key whose round a person on the page closed first, naming them', async () => {
      const api = fakePublicApi();
      const [dismissed, answered] = [seed(api), seed(api)];
      expect(await api.runners.dismiss(OLGA, dismissed.id)).toMatchObject({ ok: true });
      expect(await api.runners.answer(OLGA, answered.id, { answers: ANSWERS })).toMatchObject({ ok: true });
      const key = await caller(api, SECRETS.runners);
      expect(await service(api).answerJob(key, dismissed.id, { answers: ANSWERS })).toEqual({ ok: false, code: 'conflict', message: 'Dismissed by @olga' });
      expect(await service(api).dismissJob(key, answered.id, {})).toEqual({ ok: false, code: 'conflict', message: 'Already answered by @olga' });
    });

    it('answers 409 conflict to a job that is not waiting for an answer', async () => {
      const api = fakePublicApi();
      const failed = seed(api, { status: 'failed', outcome: null });
      expect(await service(api).answerJob(await caller(api, SECRETS.runners), failed.id, { answers: ANSWERS })).toEqual({ ok: false, code: 'conflict', message: 'This job is not waiting for an answer.' });
    });

    it('answers 422 to answers that are not one to each question, naming the field, and queues nothing', async () => {
      const api = fakePublicApi();
      const job = seed(api);
      const key = await caller(api, SECRETS.runners);
      for (const answers of [{ 'And the tests?': 'Add one' }, { 'Which fix?': 'Guard the input', 'And the tests?': 'Add one' }]) {
        expect(await service(api).answerJob(key, job.id, { answers })).toEqual({ ok: false, code: 'invalid_request', message: 'answers: Answer each question once, and only the ones asked.' });
      }
      expect(api.runnersState.jobs).toHaveLength(1);
      expect(api.runnersState.questions[0]?.closed_at).toBeNull();
    });

    it('answers 422 to a repository’s own skill, whose questions can only be dismissed, and dismisses them', async () => {
      const api = fakePublicApi();
      const job = seed(api, { line: '/triage-bug 314' });
      const key = await caller(api, SECRETS.runners);
      expect(await service(api).answerJob(key, job.id, { answers: ANSWERS })).toEqual({
        ok: false, code: 'invalid_request', message: 'answers: /triage-bug is a repository\'s own skill: its questions can only be dismissed.',
      });
      expect(await service(api).dismissJob(key, job.id, {})).toMatchObject({ ok: true, value: { questions: { state: 'dismissed' } } });
    });

    it('answers 404 for what a key learns nothing of: a person’s job, another workspace’s, none at all, a job that asked none', async () => {
      const api = fakePublicApi();
      const person = seed(api, { sent_by_key: null });
      const quiet = seed(api, {}, false);
      const key = await caller(api, SECRETS.runners);
      expect(await service(api).answerJob(key, person.id, { answers: ANSWERS })).toEqual({ ok: false, code: 'not_found', message: 'No such job.' });
      expect(await service(api).answerJob(key, UNKNOWN_JOB, { answers: ANSWERS })).toMatchObject({ ok: false, code: 'not_found' });
      expect(await service(api).answerJob(key, quiet.id, { answers: ANSWERS })).toEqual({ ok: false, code: 'not_found', message: 'This job asked no question.' });
      expect(await service(api).answerJob(await caller(api, SECRETS.south), person.id, { answers: ANSWERS })).toMatchObject({ ok: false, code: 'not_found' });
      expect(api.runnersState.jobs).toHaveLength(2);
    });

    it('answers 403 to a key whose list leaves the job’s repository out, and queues nothing', async () => {
      const api = fakePublicApi();
      const job = seed(api);
      expect(await service(api).answerJob(await caller(api, SECRETS.runnersLimited), job.id, { answers: ANSWERS })).toEqual({
        ok: false, code: 'forbidden', message: 'demo-org/app is not on this API key’s list of repositories.',
      });
      expect(api.runnersState.jobs).toHaveLength(1);
      expect(api.runnersState.questions[0]?.closed_at).toBeNull();
    });

    it('answers 403 when the person who made the job’s key left the workspace, as the resume would be queued as them', async () => {
      const api = fakePublicApi();
      const job = seed(api, { sent_by: '00000000-0000-4000-8000-0000018300e1' });
      expect(await service(api).answerJob(await caller(api, SECRETS.runners), job.id, { answers: ANSWERS })).toMatchObject({ ok: false, code: 'forbidden' });
      expect(api.runnersState.jobs).toHaveLength(1);
    });
  });

  describe('dismissing', () => {
    it('closes the round with no answer and no job queued, and answers the job with its questions dismissed', async () => {
      const api = fakePublicApi();
      const job = seed(api);
      const dismissed = valueOf(await service(api).dismissJob(await caller(api, SECRETS.runnersOther), job.id, { acting_for: 'Jane D.' }));
      expect(dismissed).toMatchObject({ id: job.id, status: 'done', outcome: 'need_human', questions: { state: 'dismissed' }, continued_by: null });
      expect(api.runnersState.jobs).toHaveLength(1);
      expect(api.runnersState.questions[0]).toMatchObject({ answers: null, closed_by: null, closed_by_key: OTHER_KEY, closed_for: 'Jane D.', resume_job: null });
    });

    it('reads the dismissal back with the key by name, and answers 409 to a second close', async () => {
      const api = fakePublicApi();
      const job = seed(api);
      const key = await caller(api, SECRETS.runnersOther);
      valueOf(await service(api).dismissJob(key, job.id, {}));
      expect(valueOf(await service(api).jobQuestions(key, job.id))).toMatchObject({ state: 'dismissed', answers: null, closed_by: { key: 'Support bot', acting_for: null } });
      const closed = { ok: false, code: 'conflict', message: 'Dismissed by API key Support bot' };
      expect(await service(api).dismissJob(key, job.id, {})).toEqual(closed);
      expect(await service(api).answerJob(key, job.id, { answers: ANSWERS })).toEqual(closed);
    });

    it('answers 404 and 403 as an answer does, and 409 for a job not waiting', async () => {
      const api = fakePublicApi();
      const job = seed(api);
      const person = seed(api, { sent_by_key: null });
      const failed = seed(api, { status: 'failed', outcome: null });
      expect(await service(api).dismissJob(await caller(api, SECRETS.runners), person.id, {})).toEqual({ ok: false, code: 'not_found', message: 'No such job.' });
      expect(await service(api).dismissJob(await caller(api, SECRETS.south), job.id, {})).toMatchObject({ ok: false, code: 'not_found' });
      expect(await service(api).dismissJob(await caller(api, SECRETS.runnersLimited), job.id, {})).toMatchObject({ ok: false, code: 'forbidden' });
      expect(await service(api).dismissJob(await caller(api, SECRETS.runners), failed.id, {})).toEqual({ ok: false, code: 'conflict', message: 'This job is not waiting for an answer.' });
      expect(api.runnersState.questions.filter((q) => q.closed_at !== null)).toEqual([]);
    });
  });
});

// PRD 2425 s7: a key cancels a job a key of its workspace sent, as the Runners page's Cancel does, and relaunches one as the page
// offers (Send again, Resume): the new job stays the first one's key's, continues it and keeps its notify_url. Any key of the
// workspace acts on any key's job within its allow-list; a person's job and another workspace's read as no such job.
describe('a key cancelling and relaunching its job (PRD 2425 s7)', () => {
  const UNKNOWN_JOB = '00000000-0000-4000-8000-00000000dead';
  const NOTIFY = 'https://hooks.example.com/omni';
  const MISSING = { ok: false, code: 'not_found', message: 'No such job.' };

  /** A bug fix the first key of the workspace sent through Olga to the fleet cia, in demo-org/app: queued, unless told otherwise. */
  function seed(api: FakePublicApi, more: Partial<ReturnType<typeof jobRow>> = {}) {
    const job = jobRow({ line: '/omni:bug-fix #314', sent_by: OLGA, sent_by_key: API_KEY, to_fleet: 'cia', notify_url: NOTIFY, ...more });
    api.runnersState.jobs.push(job);
    return job;
  }
  /** A job that ended `failed`, which the page offers Send again for. */
  const failed = (api: FakePublicApi, more: Partial<ReturnType<typeof jobRow>> = {}) => seed(api, {
    status: 'failed', exit_code: 1, reason: 'exit 1', runner_id: SHARED, claimed_at: T0.toISOString(), running_at: T0.toISOString(), ended_at: T0.toISOString(), ...more,
  });
  const service = (api: FakePublicApi) => publicApiService(api.repository, api.runners);
  const valueOf = <T>(answered: { ok: true; value: T } | { ok: false; message: string }): T => {
    if (!answered.ok) throw new Error(answered.message);
    return answered.value;
  };

  describe('cancelling', () => {
    it('ends a queued job at once as the key that cancels, whichever key sent it, and answers it as a job', async () => {
      const api = fakePublicApi();
      const job = seed(api);
      const cancelled = valueOf(await service(api).cancelJob(await caller(api, SECRETS.runnersOther), job.id, { acting_for: 'Jane D.' }));
      expect(cancelled).toMatchObject({ id: job.id, status: 'cancelled', ended_at: expect.any(String) as string, cancelled_by: { key: 'Support bot', acting_for: 'Jane D.' } });
      expect(api.runnersState.jobs[0]).toMatchObject({ status: 'cancelled', cancel_requested: true, cancelled_by_key: OTHER_KEY, cancelled_for: 'Jane D.' });
    });

    it('asks a running job to stop, and says so with the key that asked', async () => {
      const api = fakePublicApi();
      const job = seed(api, { status: 'running', runner_id: SHARED, claimed_at: T0.toISOString(), running_at: T0.toISOString() });
      const asked = valueOf(await service(api).cancelJob(await caller(api, SECRETS.runners), job.id, {}));
      expect(asked).toMatchObject({ status: 'running', ended_at: null, cancelled_by: { key: 'QA dashboard', acting_for: null } });
      expect(api.runnersState.jobs[0]).toMatchObject({ status: 'running', cancel_requested: true, cancelled_for: null });
    });

    it('reads back with the key by name, beside the job the key reads', async () => {
      const api = fakePublicApi();
      const job = seed(api);
      valueOf(await service(api).cancelJob(await caller(api, SECRETS.runnersOther), job.id, { acting_for: 'Ann P.' }));
      expect(valueOf(await service(api).job(await caller(api, SECRETS.runners), job.id))).toMatchObject({ status: 'cancelled', cancelled_by: { key: 'Support bot', acting_for: 'Ann P.' } });
    });

    it('answers 409 conflict to an ended job, in the page’s words, and changes nothing', async () => {
      const api = fakePublicApi();
      const [done, ended] = [failed(api, { status: 'done', exit_code: 0 }), failed(api)];
      const key = await caller(api, SECRETS.runners);
      expect(await service(api).cancelJob(key, done.id, {})).toEqual({ ok: false, code: 'conflict', message: 'This job has ended: done.' });
      expect(await service(api).cancelJob(key, ended.id, {})).toEqual({ ok: false, code: 'conflict', message: 'This job has ended: failed.' });
      expect(api.runnersState.jobs.map((j) => j.cancelled_by_key ?? null)).toEqual([null, null]);
    });

    it('answers 404 for what a key learns nothing of: a person’s job, another workspace’s, none at all, and changes nothing', async () => {
      const api = fakePublicApi();
      const person = seed(api, { sent_by_key: null, sent_by: OLGA });
      const mine = seed(api);
      const key = await caller(api, SECRETS.runners);
      expect(await service(api).cancelJob(key, person.id, {})).toEqual(MISSING);
      expect(await service(api).cancelJob(key, UNKNOWN_JOB, {})).toEqual(MISSING);
      expect(await service(api).cancelJob(await caller(api, SECRETS.south), mine.id, {})).toEqual(MISSING);
      expect(api.runnersState.jobs.map((j) => j.status)).toEqual(['queued', 'queued']);
    });

    it('answers 403 to a key whose list leaves the job’s repository out, and changes nothing', async () => {
      const api = fakePublicApi();
      const job = seed(api);
      expect(await service(api).cancelJob(await caller(api, SECRETS.runnersLimited), job.id, {})).toEqual({
        ok: false, code: 'forbidden', message: 'demo-org/app is not on this API key’s list of repositories.',
      });
      expect(api.runnersState.jobs[0]).toMatchObject({ status: 'queued', cancel_requested: false });
    });

    it('fails, rather than answering a refusal of its own, when the runners fail: the controller answers 500', async () => {
      const api = fakePublicApi();
      const job = seed(api);
      const broken = { ...api.runners, cancelByKey: () => Promise.resolve({ ok: false as const, kind: 'unavailable' as const, error: 'runner_jobs: permission denied' }) };
      await expect(publicApiService(api.repository, broken).cancelJob(await caller(api, SECRETS.runners), job.id, {})).rejects.toThrow('runners: unavailable runner_jobs: permission denied');
    });
  });

  describe('relaunching', () => {
    it('sends a failed job again as the job’s key, continuing it, and answers it as a job: queued, continues, acting_for, no questions', async () => {
      const api = fakePublicApi();
      const job = failed(api);
      const relaunched = valueOf(await service(api).relaunchJob(await caller(api, SECRETS.runnersOther), job.id, { acting_for: 'Jane D.' }));
      expect(relaunched).toMatchObject({
        line: '/omni:bug-fix #314', repo: 'demo-org/app', status: 'queued', continues: job.id, continued_by: null, acting_for: 'Jane D.', questions: null, outcome: null, prs: [],
      });
      // The key that relaunched is not the key that sent the job: the new job stays the sender’s, with its notify_url.
      expect(api.runnersState.jobs.find((j) => j.id === relaunched.id)).toMatchObject({ sent_by: OLGA, sent_by_key: API_KEY, continues: job.id, to_fleet: 'cia', notify_url: NOTIFY, acting_for: 'Jane D.' });
    });

    it('resumes a job stopped mid-way and sends a cancelled one again, with the line each ran', async () => {
      const api = fakePublicApi();
      const stopped = failed(api, { status: 'done', exit_code: 0, reason: null, outcome: 'stopped', line: '/omni:yolo 2338' });
      const cancelled = failed(api, { status: 'cancelled', cancel_requested: true, reason: null });
      const key = await caller(api, SECRETS.runners);
      expect(valueOf(await service(api).relaunchJob(key, stopped.id, {}))).toMatchObject({ line: '/omni:yolo 2338', continues: stopped.id, acting_for: null });
      expect(valueOf(await service(api).relaunchJob(key, cancelled.id, {}))).toMatchObject({ line: '/omni:bug-fix #314', continues: cancelled.id });
    });

    it('reads the first job as carried on by the new one, and the new one by the key that sent the first', async () => {
      const api = fakePublicApi();
      const job = failed(api);
      const relaunched = valueOf(await service(api).relaunchJob(await caller(api, SECRETS.runnersOther), job.id, {}));
      const sender = await caller(api, SECRETS.runners);
      expect(valueOf(await service(api).job(sender, job.id))).toMatchObject({ continued_by: relaunched.id });
      expect(valueOf(await service(api).job(sender, relaunched.id))).toMatchObject({ id: relaunched.id, continues: job.id });
    });

    it('answers 409 conflict to a job the page offers neither Send again nor Resume for, and queues nothing', async () => {
      const api = fakePublicApi();
      const [live, handedOff, asked] = [seed(api), failed(api, { status: 'done', exit_code: 0, outcome: 'pr-opened' }), failed(api, { status: 'done', exit_code: 0, outcome: 'human' })];
      const key = await caller(api, SECRETS.runners);
      const refused = { ok: false, code: 'conflict', message: 'This job is neither failed, cancelled nor stopped mid-way: the Runners page offers neither Send again nor Resume for it.' };
      for (const job of [live, handedOff, asked]) expect(await service(api).relaunchJob(key, job.id, {})).toEqual(refused);
      expect(api.runnersState.jobs).toHaveLength(3);
    });

    it('answers 409 conflict to a job already carried on, whoever relaunches it again: one new job each', async () => {
      const api = fakePublicApi();
      const job = failed(api);
      valueOf(await service(api).relaunchJob(await caller(api, SECRETS.runnersOther), job.id, {}));
      const carried = { ok: false, code: 'conflict', message: 'This job was carried on already.' };
      expect(await service(api).relaunchJob(await caller(api, SECRETS.runners), job.id, {})).toEqual(carried);
      expect(await service(api).relaunchJob(await caller(api, SECRETS.runnersOther), job.id, {})).toEqual(carried);
      expect(api.runnersState.jobs.filter((j) => j.continues === job.id)).toHaveLength(1);
    });

    it('answers 404 for what a key learns nothing of: a person’s job, another workspace’s, none at all, and queues nothing', async () => {
      const api = fakePublicApi();
      const person = failed(api, { sent_by_key: null, sent_by: OLGA });
      const mine = failed(api);
      const key = await caller(api, SECRETS.runners);
      expect(await service(api).relaunchJob(key, person.id, {})).toEqual(MISSING);
      expect(await service(api).relaunchJob(key, UNKNOWN_JOB, {})).toEqual(MISSING);
      expect(await service(api).relaunchJob(await caller(api, SECRETS.south), mine.id, {})).toEqual(MISSING);
      expect(api.runnersState.jobs).toHaveLength(2);
    });

    it('answers 403 to a key whose list leaves the job’s repository out, and queues nothing', async () => {
      const api = fakePublicApi();
      const job = failed(api);
      expect(await service(api).relaunchJob(await caller(api, SECRETS.runnersLimited), job.id, {})).toEqual({
        ok: false, code: 'forbidden', message: 'demo-org/app is not on this API key’s list of repositories.',
      });
      expect(api.runnersState.jobs).toHaveLength(1);
    });

    it('answers 403 when the person who made the job’s key left the workspace, as the new job would be queued as them', async () => {
      const api = fakePublicApi();
      const job = failed(api, { sent_by: EVE });
      expect(await service(api).relaunchJob(await caller(api, SECRETS.runners), job.id, {})).toMatchObject({ ok: false, code: 'forbidden' });
      expect(api.runnersState.jobs).toHaveLength(1);
    });

    it('answers 409 conflict, not 404, when the runner the job named is gone: the job itself is there', async () => {
      const api = fakePublicApi();
      const job = failed(api, { to_fleet: null, to_runner: '00000000-0000-4000-8000-0000018301ff' });
      expect(await service(api).relaunchJob(await caller(api, SECRETS.runners), job.id, {})).toEqual({ ok: false, code: 'conflict', message: 'No such runner in this workspace.' });
      expect(api.runnersState.jobs).toHaveLength(1);
    });

    it('answers 422 to a line the runners no longer take, in their words with no field named, and queues nothing', async () => {
      const api = fakePublicApi();
      const job = failed(api, { line: '/validate-prd 347' });
      expect(await service(api).relaunchJob(await caller(api, SECRETS.runners), job.id, {})).toEqual({
        ok: false, code: 'invalid_request', message: '/validate-prd is not allowed on a runner for demo-org/app: an owner allows it in Settings › Repositories.',
      });
      expect(api.runnersState.jobs).toHaveLength(1);
    });

    it('fails, rather than answering a refusal of its own, when the runners fail: the controller answers 500', async () => {
      const api = fakePublicApi();
      const job = failed(api);
      const broken = { ...api.runners, relaunchByKey: () => Promise.resolve({ ok: false as const, kind: 'unavailable' as const, error: 'runner_jobs: permission denied' }) };
      await expect(publicApiService(api.repository, broken).relaunchJob(await caller(api, SECRETS.runners), job.id, {})).rejects.toThrow('runners: unavailable runner_jobs: permission denied');
    });
  });
});

// PRD 2425 s8: a start says whom the job is for and a link to ping. The link is checked before anything is queued (a host that is not
// public is a 422), the job stores both as given, and what it does afterwards is pinged to the link once the response has gone.
describe('a key starting a job that pings a link (PRD 2425 s8)', () => {
  const LINK = 'https://hooks.example.com/omni/jobs';
  const BUG = { repo: 'demo-org/app', description: 'Issue 548 totals' };
  const MEGA = { repo: 'demo-org/plan', description: 'https://github.com/demo-org/plan/issues/612' };
  type Says = Partial<Pick<StartBugFix, 'acting_for' | 'notify_url'>>;
  type Start = (api: FakePublicApi, key: ApiKeyCaller, says: Says, port?: RunnersPort) => Promise<Answered<ApiJob>>;
  /** Both starts, the same rules: a bug fix and a mega bug fix (whose plan repository is set up here). */
  const both: [string, Start][] = [
    ['a bug fix', (api, key, says, port = api.runners) => publicApiService(api.repository, port).startBugFix(key, { ...BUG, ...says })],
    ['a mega bug fix', (api, key, says, port = api.runners) => {
      api.planRepository(WORKSPACE, 'demo-org/plan');
      return publicApiService(api.repository, port).startMegaBugFix(key, { ...MEGA, ...says });
    }],
  ];
  /** The runners, the links they were asked about recorded. */
  const watched = (api: FakePublicApi) => {
    const asked: string[] = [];
    const port: RunnersPort = { ...api.runners, notifyCheck: (url) => { asked.push(url); return api.runners.notifyCheck(url); } };
    return { port, asked };
  };
  /** A link that carries a login, built here so none stands in the source. */
  const carrying = (login: string[]) => ['https://', login.join(':'), '@hooks.example.com/omni'].join('');
  const bodies = (api: FakePublicApi) => api.posts.map((post) => JSON.parse(post.body) as Record<string, string>);

  describe.each(both)('%s', (_name, start) => {
    it('stores whom it is for and the link as given, answers whom it is for and never the link, and pings nothing yet', async () => {
      const api = fakePublicApi();
      const started = await start(api, await caller(api, SECRETS.runners), { acting_for: 'Jane D.', notify_url: LINK });
      expect(started).toMatchObject({ ok: true, value: { status: 'queued', acting_for: 'Jane D.' } });
      expect(JSON.stringify(started)).not.toContain(LINK);
      expect(api.runnersState.jobs).toHaveLength(1);
      expect(api.runnersState.jobs[0]).toMatchObject({ acting_for: 'Jane D.', notify_url: LINK, sent_by_key: API_KEY });
      await api.flushPings();
      expect(api.posts).toEqual([]);
    });

    it('stores neither when the start says neither, and checks no link', async () => {
      const api = fakePublicApi();
      const { port, asked } = watched(api);
      const started = await start(api, await caller(api, SECRETS.runners), {}, port);
      expect(started).toMatchObject({ ok: true, value: { acting_for: null } });
      expect(api.runnersState.jobs[0]).toMatchObject({ acting_for: null, notify_url: null });
      expect(asked).toEqual([]);
    });

    it('takes a link without whom it is for, and whom it is for without a link', async () => {
      const api = fakePublicApi();
      const key = await caller(api, SECRETS.runners);
      expect(await start(api, key, { notify_url: LINK })).toMatchObject({ ok: true, value: { acting_for: null } });
      expect(await start(api, key, { acting_for: 'Jane D.' })).toMatchObject({ ok: true, value: { acting_for: 'Jane D.' } });
      expect(api.runnersState.jobs.map((job) => [job.acting_for, job.notify_url])).toEqual([[null, LINK], ['Jane D.', null]]);
    });

    it.each([
      ['is not https', 'http://hooks.example.com/omni', 'must be an https link'],
      ['carries a user name and a password', carrying(['user', 'pw']), 'must not carry a user name or a password'],
      ['carries a user name', carrying(['user']), 'must not carry a user name or a password'],
      ['names a host of the private network', 'https://intranet.example.com/omni', 'intranet.example.com resolves to a private address, which is not public'],
      ['names a host that resolves to loopback', 'https://loopback.example.com/omni', 'loopback.example.com resolves to a loopback address, which is not public'],
      ['is the address of a cloud metadata service', 'https://169.254.169.254/latest/meta-data', 'is a link-local address, not a public one'],
      ['is a private address', 'https://10.0.0.1/omni', 'is a private address, not a public one'],
      ['is the loopback address of IPv6', 'https://[::1]/omni', 'is a loopback address, not a public one'],
      ['names a host that does not resolve', 'https://nowhere.example.com/omni', 'nowhere.example.com does not resolve'],
    ])('answers 422 on notify_url when it %s, and queues nothing', async (_why, link, reason) => {
      const api = fakePublicApi();
      expect(await start(api, await caller(api, SECRETS.runners), { acting_for: 'Jane D.', notify_url: link })).toEqual({ ok: false, code: 'invalid_request', message: `notify_url: ${reason}` });
      expect(api.runnersState.jobs).toEqual([]);
      expect(api.posts).toEqual([]);
    });

    it('keeps the allow-list in front of the link: a repository off the key’s list is a 403 whatever the link is, and no link is checked', async () => {
      const api = fakePublicApi();
      const { port, asked } = watched(api);
      const refused = await start(api, await caller(api, SECRETS.runnersLimited), { notify_url: 'https://intranet.example.com/omni' }, port);
      expect(refused).toMatchObject({ ok: false, code: 'forbidden' });
      expect(asked).toEqual([]);
    });
  });

  it('keeps the plan check in front of the link for a mega bug fix: a repository no product names is refused on repo, no link checked', async () => {
    const api = fakePublicApi();
    const { port, asked } = watched(api);
    const refused = await publicApiService(api.repository, port).startMegaBugFix(await caller(api, SECRETS.runners), { ...MEGA, notify_url: 'https://intranet.example.com/omni' });
    expect(refused).toMatchObject({ ok: false, code: 'invalid_request', message: expect.stringMatching(/^repo: /) as string });
    expect(asked).toEqual([]);
  });

  it('checks the link it is given, once, before queueing', async () => {
    const api = fakePublicApi();
    const { port, asked } = watched(api);
    expect(await both[0]?.[1](api, await caller(api, SECRETS.runners), { notify_url: LINK }, port)).toMatchObject({ ok: true });
    expect(asked).toEqual([LINK]);
  });

  describe('the pings', () => {
    /** A job started with the link, claimed by Olga's shared runner. */
    async function claimed(api: FakePublicApi) {
      const started = await publicApiService(api.repository, api.runners).startBugFix(await caller(api, SECRETS.runners), { ...BUG, notify_url: LINK });
      const id = started.ok ? started.value.id : '';
      expect((await api.runners.next(OLGA, SHARED)).ok).toBe(true);
      return id;
    }

    it('are posted to the link after the response, each with `{job_id, event, at}` and nothing else, to the address just checked', async () => {
      const api = fakePublicApi();
      const id = await claimed(api);
      expect(api.posts).toEqual([]);
      await api.flushPings();
      expect(api.posts).toEqual([{ url: LINK, address: '93.184.216.34', body: JSON.stringify({ job_id: id, event: 'status', at: T0.toISOString() }) }]);
      expect(Object.keys(bodies(api)[0] ?? {})).toEqual(['job_id', 'event', 'at']);

      expect(await api.runners.update(OLGA, id, { status: 'running' })).toMatchObject({ ok: true });
      expect(await api.runners.update(OLGA, id, { status: 'done', exitCode: 0, outcome: 'pr-opened' })).toMatchObject({ ok: true });
      await api.flushPings();
      expect(bodies(api).map((body) => body.event)).toEqual(['status', 'status', 'outcome']);
      expect(api.pingLogs).toEqual([]);
    });

    it('are posted for a change a key makes, as the page’s Cancel does', async () => {
      const api = fakePublicApi();
      const started = await publicApiService(api.repository, api.runners).startBugFix(await caller(api, SECRETS.runners), { ...BUG, notify_url: LINK });
      const id = started.ok ? started.value.id : '';
      expect(await publicApiService(api.repository, api.runners).cancelJob(await caller(api, SECRETS.runners), id, {})).toMatchObject({ ok: true });
      await api.flushPings();
      expect(bodies(api)).toEqual([{ job_id: id, event: 'status', at: T0.toISOString() }]);
    });

    it('are three tries at most when the link answers an error, and then a log that names the job and the host, never the path', async () => {
      const api = fakePublicApi();
      api.answer.status = 500;
      const id = await claimed(api);
      await api.flushPings();
      expect(api.posts).toHaveLength(3);
      expect(api.pingLogs).toHaveLength(1);
      expect(api.pingLogs[0]).toContain(id);
      expect(api.pingLogs[0]).toContain('hooks.example.com');
      expect(api.pingLogs[0]).not.toContain('/omni/jobs');
    });

    it('check the host again, so a name that moved to a private address since the start gets no post', async () => {
      const api = fakePublicApi();
      const id = await claimed(api);
      api.hosts.set('hooks.example.com', ['10.0.0.9']);
      await api.flushPings();
      expect(api.posts).toEqual([]);
      expect(api.pingLogs).toEqual([`ping ${id} (status) to hooks.example.com was not delivered: hooks.example.com resolves to a private address, which is not public`]);
    });
  });
});
