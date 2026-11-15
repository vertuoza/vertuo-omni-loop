import { describe, expect, it } from 'vitest';
import type { JobRow, RunnerRow } from './runners.repository';
import { reachedRepos, runnersService, spansProduct } from './runners.service';
import { KEY_APP_CREDENTIALS, OMNI_APP, OTHER_INSTALLATION, stubGithub, type Installed } from './fixtures/github.fake';
import { API_KEY, fakeStore, jobRow, KEY_APP, OLGA, runnerRow, SHARED, T0, WORKSPACE, type KeyState, type ProductState } from './fixtures/store.fake';

// The ultra skills on a runner (PRD 2873 s1, BR-PRODUCT-63): `/omni:ultra-yolo`, `/omni:ultra-wave` and `/omni:ultra-yolo-fix`
// build a PRD across a product's repositories, so they are sent from a product's plan repository and nowhere else; and, like
// `/omni:mega-bug-fix`, a claimed one's token reaches the product's repositories that the key allows and the App's installation
// holds, never another. The service on the store's fake and a stubbed GitHub (./fixtures/github.fake.ts).

const PLAN = 'demo-org/plan';
/** A product whose plan repository is `PLAN`, and which names it among its repositories. */
const SHOP: ProductState = { id: 'shop', plan: PLAN, repositories: [PLAN, 'demo-org/api', 'demo-org/web', 'other-org/ios'] };
/** The App's other installation holds `other-org`'s repositories; the demo installation holds every other. */
const INSTALLED: Record<string, Installed> = { 'other-org/ios': OTHER_INSTALLATION };
const RUNNER: RunnerRow = runnerRow({ id: SHARED, name: 'shared', slots: 1, github_app: true, repos: [PLAN, 'demo-org/app', 'demo-org/api'] });
const KEY = { id: API_KEY, name: 'Missions', workspace: WORKSPACE, maker: OLGA };
const ULTRA = ['ultra-yolo', 'ultra-wave', 'ultra-yolo-fix'] as const;

function world({ jobs = [], repos = [], products = [SHOP], installed = INSTALLED }: {
  jobs?: JobRow[]; repos?: string[]; products?: ProductState[]; installed?: Record<string, Installed>;
} = {}) {
  let now = T0;
  const keys: KeyState[] = [{ id: API_KEY, app: KEY_APP, working: true, repos }];
  const { store, state, products: productsOf } = fakeStore({ jobs, runners: [RUNNER], keys, products, now: () => now });
  const stub = stubGithub({}, installed);
  const clock = { now: () => now, sleep: (ms: number) => { now = new Date(now.getTime() + ms); return Promise.resolve(); } };
  return { service: runnersService(store, clock, stub.deps, undefined, productsOf), state, asked: stub.asked };
}

const send = (line: string, repo = PLAN) => ({ line, repo, target: { kind: 'any' as const } });
const mintedFor = (asked: ReturnType<typeof stubGithub>['asked']) => asked.minted.map((minted) => minted.repositories);
const value = <T>(served: { ok: true; value: T } | { ok: false; kind: string; error: string }): T => {
  if (!served.ok) throw new Error(`refused: ${served.kind} ${served.error}`);
  return served.value;
};

describe('spansProduct()', () => {
  it('holds the mega bug fix and the three ultra skills, whose work spans a product\'s repositories', () => {
    for (const skill of ['mega-bug-fix', ...ULTRA]) expect(spansProduct(`/omni:${skill} 12`), skill).toBe(true);
  });

  it('holds no other skill, and no repository\'s own skill of the same name', () => {
    for (const line of ['/omni:yolo 12', '/omni:bug-fix 12', '/omni:wave 12', '/ultra-yolo 12', '/omni:drive 12']) expect(spansProduct(line), line).toBe(false);
  });
});

describe('an ultra line sent', () => {
  it.each(ULTRA)('/omni:%s is queued from a product\'s plan repository, by a person or a key', async (skill) => {
    const w = world();
    expect(value(await w.service.send(OLGA, send(`/omni:${skill} 12`)))).toMatchObject({ status: 'queued', line: `/omni:${skill} 12`, repo: PLAN });
    expect(value(await w.service.sendByKey(KEY, { repo: PLAN, line: `/omni:${skill} 12` }))).toMatchObject({ status: 'queued', repo: PLAN });
  });

  it('is queued from a plan repository its product does not name among its repositories', async () => {
    const w = world({ products: [{ id: 'shop', plan: PLAN, repositories: ['demo-org/api'] }] });
    expect(value(await w.service.send(OLGA, send('/omni:ultra-yolo 12', 'Demo-Org/Plan')))).toMatchObject({ status: 'queued', repo: PLAN });
  });

  it.each(ULTRA)('/omni:%s is refused from another repository of the product, naming its plan repository, and nothing is queued', async (skill) => {
    const w = world();
    const refused = { ok: false, kind: 'malformed', error: `/omni:${skill} runs from a product's plan repository: send it from ${PLAN}.` };
    expect(await w.service.send(OLGA, send(`/omni:${skill} 12`, 'demo-org/api'))).toEqual(refused);
    expect(await w.service.sendByKey(KEY, { repo: 'demo-org/api', line: `/omni:${skill} 12` })).toEqual(refused);
    expect(w.state.jobs).toEqual([]);
  });

  it('is refused from a repository whose product has no plan repository, or that is in no product, saying so', async () => {
    const w = world({ products: [{ id: 'shop', repositories: ['demo-org/api', 'demo-org/web'] }] });
    expect(await w.service.send(OLGA, send('/omni:ultra-wave 12', 'demo-org/api'))).toEqual({
      ok: false, kind: 'malformed', error: '/omni:ultra-wave runs from a product\'s plan repository: demo-org/api is no product\'s plan repository.',
    });
    expect(await w.service.send(OLGA, send('/omni:ultra-yolo 12', 'demo-org/app'))).toEqual({
      ok: false, kind: 'malformed', error: '/omni:ultra-yolo runs from a product\'s plan repository: demo-org/app is no product\'s plan repository.',
    });
    expect(w.state.jobs).toEqual([]);
  });

  it('is refused from the plan repository of an archived product', async () => {
    const w = world({ products: [{ ...SHOP, archived: true }] });
    expect(await w.service.send(OLGA, send('/omni:ultra-yolo 12'))).toMatchObject({ ok: false, kind: 'malformed' });
  });

  it('names every plan repository of the products that hold the repository, once each, in order', async () => {
    const w = world({ products: [SHOP, { id: 'docs', plan: 'demo-org/docs-plan', repositories: ['demo-org/api'] }, { id: 'again', plan: PLAN, repositories: ['demo-org/api'] }] });
    expect(await w.service.send(OLGA, send('/omni:ultra-yolo 12', 'demo-org/api'))).toMatchObject({
      error: '/omni:ultra-yolo runs from a product\'s plan repository: send it from demo-org/docs-plan or demo-org/plan.',
    });
  });

  it('leaves a mega bug fix and every other skill as they were: sent from any repository of the workspace', async () => {
    const w = world();
    expect(value(await w.service.send(OLGA, send('/omni:mega-bug-fix #12', 'demo-org/api')))).toMatchObject({ status: 'queued' });
    expect(value(await w.service.send(OLGA, send('/omni:yolo 12', 'demo-org/api')))).toMatchObject({ status: 'queued' });
  });
});

describe('an ultra job\'s token (BR-PRODUCT-63)', () => {
  const keyJob = (more: Partial<JobRow> = {}) => jobRow({ sent_by: OLGA, sent_by_key: API_KEY, line: '/omni:ultra-yolo 12', repo: PLAN, ...more });

  it.each(ULTRA)('/omni:%s covers its plan repository and the product\'s repositories the installation holds', async (skill) => {
    const w = world({ jobs: [keyJob({ line: `/omni:${skill} 12` })] });
    value(await w.service.next(OLGA, SHARED));
    expect(mintedFor(w.asked)).toEqual([[PLAN, 'demo-org/api', 'demo-org/web']]);
  });

  it('leaves out a repository the installation lacks, and one the key does not allow, and asks GitHub nothing of the latter', async () => {
    const w = world({ jobs: [keyJob()], repos: [PLAN, 'demo-org/api', 'other-org/ios'], installed: { ...INSTALLED, 'demo-org/api': null } });
    value(await w.service.next(OLGA, SHARED));
    expect(mintedFor(w.asked)).toEqual([[PLAN]]);
    expect(w.asked.installations).not.toContain('demo-org/web');
  });

  it('is as wide sent from the page, with no key, and at a refresh', async () => {
    const page = world({ jobs: [keyJob({ sent_by_key: null })] });
    value(await page.service.next(OLGA, SHARED));
    const refresh = world({ jobs: [keyJob({ status: 'running', runner_id: SHARED, claimed_at: T0.toISOString(), running_at: T0.toISOString() })] });
    value(await refresh.service.githubToken(OLGA, refresh.state.jobs[0]?.id ?? ''));
    expect([...mintedFor(page.asked), ...mintedFor(refresh.asked)]).toEqual([[PLAN, 'demo-org/api', 'demo-org/web'], [PLAN, 'demo-org/api', 'demo-org/web']]);
  });

  it('covers the product of the plan repository though the product does not name it among its repositories', async () => {
    const w = world({ jobs: [keyJob()], products: [{ id: 'shop', plan: PLAN, repositories: ['demo-org/web', 'demo-org/api'] }] });
    value(await w.service.next(OLGA, SHARED));
    expect(mintedFor(w.asked)).toEqual([[PLAN, 'demo-org/api', 'demo-org/web']]);
  });

  it('never covers the repositories of an archived product, or of a product whose plan repository is another', async () => {
    const archived = world({ jobs: [keyJob()], products: [{ id: 'shop', plan: PLAN, repositories: ['demo-org/web'], archived: true }] });
    value(await archived.service.next(OLGA, SHARED));
    const other = world({ jobs: [keyJob()], products: [{ id: 'docs', plan: 'demo-org/docs-plan', repositories: ['demo-org/site'] }] });
    value(await other.service.next(OLGA, SHARED));
    expect([...mintedFor(archived.asked), ...mintedFor(other.asked)]).toEqual([[PLAN], [PLAN]]);
  });

  it('keeps a yolo job to its own repository, in a product or not', async () => {
    const w = world({ jobs: [keyJob({ line: '/omni:yolo 12' })] });
    value(await w.service.next(OLGA, SHARED));
    expect(mintedFor(w.asked)).toEqual([[PLAN]]);
    expect(w.asked.installations).toEqual([PLAN]);
  });
});

describe('a spanning job of a key\'s App (PRD 2915, BR-ACCESS-1)', () => {
  const keyJob = (more: Partial<JobRow> = {}) => jobRow({ sent_by: OLGA, sent_by_key: API_KEY, line: '/omni:ultra-yolo 12', repo: PLAN, ...more });

  it('mints as the key\'s App, for the plan repository and the product\'s repositories in the allow-list that the installation holds, and no other', async () => {
    const w = world({ jobs: [keyJob()], repos: [PLAN, 'demo-org/api', 'other-org/ios'] });
    value(await w.service.next(OLGA, SHARED));
    expect(w.asked.minted.map((minted) => [minted.appId, minted.repositories])).toEqual([[KEY_APP_CREDENTIALS.appId, [PLAN, 'demo-org/api']]]);
    expect(w.asked.installations).not.toContain('demo-org/web');
  });

  it('mints as the Omni App, as wide, for a job no key sent', async () => {
    const w = world({ jobs: [keyJob({ sent_by_key: null })] });
    value(await w.service.next(OLGA, SHARED));
    expect(w.asked.minted.map((minted) => [minted.appId, minted.repositories])).toEqual([[OMNI_APP.appId, [PLAN, 'demo-org/api', 'demo-org/web']]]);
  });
});

describe('reachedRepos()', () => {
  const reach = { repo: PLAN, allowed: [] as string[], named: ['demo-org/web', PLAN, 'demo-org/api'], planned: ['demo-org/api', 'demo-org/docs'] };

  it('is the other repositories of the products that name the repository, then those of the products it plans, once each', () => {
    expect(reachedRepos(reach)).toEqual(['demo-org/web', 'demo-org/api', 'demo-org/docs']);
  });

  it('leaves out the repository itself, and any outside a non-empty allow-list; an empty one allows every repository', () => {
    expect(reachedRepos({ ...reach, allowed: [PLAN, 'demo-org/api'] })).toEqual(['demo-org/api']);
    expect(reachedRepos({ ...reach, allowed: [PLAN] })).toEqual([]);
  });

  it('is empty for a repository in no product', () => {
    expect(reachedRepos({ repo: PLAN, allowed: [], named: [], planned: [] })).toEqual([]);
  });
});
