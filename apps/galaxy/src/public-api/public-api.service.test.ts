import { describe, expect, it } from 'vitest';
import { parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { checkRunnerLine, LINE_MAX } from 'omni-loop/kit/lib/runner/line.ts';
import { API_KEY, WORKSPACE } from '../runners/fixtures/store.fake';
import { encodeCursor } from './cursor';
import { fakePublicApi, NORTHWIND, SECRETS, SOUTHWIND, type FakePublicApi } from './fixtures/public-api.fake';
import { BugFixListSchema, DESCRIPTION_MAX, MEGA_DESCRIPTION_MAX, PrdListSchema, type ListQuery } from './public-api.contract';
import { BAD_CURSOR, publicApiService, type ApiKeyCaller, type CheckInstallation, type InstallationCheck } from './public-api.service';

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

describe('a key with a GitHub App starts a job only where its App can run it (PRD 2433 s6)', () => {
  const FIX = { repo: 'Demo-Org/App', description: 'Issue 548 totals' };
  const MEGA = { repo: 'Demo-Org/Plan', description: 'https://github.com/demo-org/plan/issues/612' };
  const APP = { appId: 123456, slug: 'acme-bot', ciphertext: 'c2VhbGVk', iv: 'aXY=' };
  const ALL: InstallationCheck = { installed: true, missing: null };
  const NOT_INSTALLED = (repo: string) => `repo: the GitHub App acme-bot attached to this API key is not installed on ${repo}. Install it on that repository, with write access to contents, pull_requests and issues, then send again.`;
  const WITHOUT = (repo: string, permission: string) => `repo: the GitHub App acme-bot is installed on ${repo} without write access to ${permission}. Give it write access to contents, pull_requests and issues, then send again.`;

  /** The fake, the runners' key holding the App, and a GitHub that answers for each repository (none: not installed). */
  function setup(answers: Record<string, InstallationCheck>) {
    const api = fakePublicApi();
    api.githubApp(API_KEY, APP);
    api.planRepository(WORKSPACE, 'demo-org/plan');
    const asked: { slug: string; repo: string }[] = [];
    const check: CheckInstallation = (app, repo) => {
      asked.push({ slug: app.slug, repo });
      return Promise.resolve(answers[repo] ?? { installed: false });
    };
    return { api, asked, service: publicApiService(api.repository, api.runners, check) };
  }

  it('queues the bug fix where the App is installed with write access to contents, pull_requests and issues, after asking GitHub about that repository', async () => {
    const { api, asked, service } = setup({ 'demo-org/app': ALL });
    const started = await service.startBugFix(await caller(api, SECRETS.runners), FIX);
    expect(started).toMatchObject({ ok: true, value: { status: 'queued', repo: 'demo-org/app' } });
    expect(asked).toEqual([{ slug: 'acme-bot', repo: 'demo-org/app' }]);
    expect(api.runnersState.jobs).toHaveLength(1);
  });

  it('refuses a repository the App is not installed on: 422 github_app_not_installed naming it, and nothing queued', async () => {
    const { api, service } = setup({ 'demo-org/app': ALL });
    const refused = await service.startBugFix(await caller(api, SECRETS.runners), { ...FIX, repo: 'demo-org/other' });
    expect(refused).toEqual({ ok: false, code: 'github_app_not_installed', message: NOT_INSTALLED('demo-org/other') });
    expect(api.runnersState.jobs).toEqual([]);
  });

  for (const permission of ['contents', 'pull_requests', 'issues'] as const) {
    it(`refuses an installation with no write access to ${permission}: 422 github_app_permissions naming it, and nothing queued`, async () => {
      const { api, service } = setup({ 'demo-org/app': { installed: true, missing: permission } });
      const refused = await service.startBugFix(await caller(api, SECRETS.runners), FIX);
      expect(refused).toEqual({ ok: false, code: 'github_app_permissions', message: WITHOUT('demo-org/app', permission) });
      expect(api.runnersState.jobs).toEqual([]);
    });
  }

  it('asks GitHub nothing for a key with no App, and queues as it did', async () => {
    const { api, asked, service } = setup({});
    const started = await service.startBugFix(await caller(api, SECRETS.runnersLimited), { ...FIX, repo: 'demo-org/other' });
    expect(started).toMatchObject({ ok: true, value: { status: 'queued', repo: 'demo-org/other' } });
    expect(asked).toEqual([]);
    expect(api.runnersState.jobs).toHaveLength(1);
  });

  it('reads no App at all when this deployment has no means to ask GitHub', async () => {
    const api = fakePublicApi();
    api.githubApp(API_KEY, APP);
    const started = await publicApiService(api.repository, api.runners).startBugFix(await caller(api, SECRETS.runners), FIX);
    expect(started).toMatchObject({ ok: true });
    expect(api.calls).not.toContain('githubAppOf');
  });

  it('keeps the allow-list in front of the App: a repository off the list is 403, with no App read and no GitHub call', async () => {
    const { api, asked, service } = setup({ 'demo-org/app': ALL });
    api.githubApp('k-runners-limited', APP);
    const limited = await caller(api, SECRETS.runnersLimited);
    api.calls.length = 0;
    expect(await service.startBugFix(limited, FIX)).toMatchObject({ ok: false, code: 'forbidden' });
    expect(await service.startMegaBugFix(limited, MEGA)).toMatchObject({ ok: false, code: 'forbidden' });
    expect(api.calls).toEqual([]);
    expect(asked).toEqual([]);
  });

  it('queues nothing when GitHub cannot be asked, and says so by throwing: the controller answers 500', async () => {
    const api = fakePublicApi();
    api.githubApp(API_KEY, APP);
    const down: CheckInstallation = () => Promise.reject(new Error('GitHub answered 502 to GET /repos/demo-org/app/installation'));
    const service = publicApiService(api.repository, api.runners, down);
    await expect(service.startBugFix(await caller(api, SECRETS.runners), FIX)).rejects.toThrow('GitHub answered 502');
    expect(api.runnersState.jobs).toEqual([]);
  });

  it('checks a mega bug fix on its plan repository, and queues it when the App is installed there', async () => {
    const { api, asked, service } = setup({ 'demo-org/plan': ALL });
    const started = await service.startMegaBugFix(await caller(api, SECRETS.runners), MEGA);
    expect(started).toMatchObject({ ok: true, value: { status: 'queued', repo: 'demo-org/plan' } });
    expect(asked).toEqual([{ slug: 'acme-bot', repo: 'demo-org/plan' }]);
  });

  it('refuses a mega bug fix whose plan repository the App is not installed on, or lacks a permission on, queueing nothing', async () => {
    const { api, service } = setup({});
    const key = await caller(api, SECRETS.runners);
    expect(await service.startMegaBugFix(key, MEGA)).toEqual({ ok: false, code: 'github_app_not_installed', message: NOT_INSTALLED('demo-org/plan') });
    const lacking = setup({ 'demo-org/plan': { installed: true, missing: 'issues' } });
    expect(await lacking.service.startMegaBugFix(await caller(lacking.api, SECRETS.runners), MEGA)).toEqual({
      ok: false, code: 'github_app_permissions', message: WITHOUT('demo-org/plan', 'issues'),
    });
    expect(api.runnersState.jobs).toEqual([]);
    expect(lacking.api.runnersState.jobs).toEqual([]);
  });

  it('keeps the plan check in front of the App: a repository no product names as its plan repository is refused with no App read', async () => {
    const { api, asked, service } = setup({ 'demo-org/app': ALL });
    api.calls.length = 0;
    expect(await service.startMegaBugFix(await caller(api, SECRETS.runners), { ...MEGA, repo: 'demo-org/app' })).toMatchObject({ ok: false, code: 'invalid_request' });
    expect(api.calls).not.toContain('githubAppOf');
    expect(asked).toEqual([]);
  });
});
