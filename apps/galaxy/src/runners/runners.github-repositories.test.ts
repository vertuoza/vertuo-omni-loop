import { describe, expect, it } from 'vitest';
import type { JobRow, RunnerRow } from './runners.repository';
import { productReposOf, runnersService } from './runners.service';
import { OTHER_INSTALLATION, stubGithub, type Installed } from './fixtures/github.fake';
import { API_KEY, fakeStore, jobRow, KEY_APP, OLGA, runnerRow, SHARED, T0, type KeyState, type ProductState } from './fixtures/store.fake';

// Which repositories a job's Omni App token reaches (PRD 2433 s7, the outbox answer to s7-01, PRD 2573 s1, BR-PRODUCT-63): the
// job's own repository; for a mega bug fix also every other repository of its plan repository's product that the App's
// installation holds, whoever sent it; and, for a key's job, never one outside the key's allow-list (agent_tokens.repos, which
// api_key_github_app_of_job() hands the server; no list means every repository of the workspace), at the claim or at a refresh.
// The service on the store's fake and a stubbed GitHub (./fixtures/github.fake.ts).

const PLAN = 'demo-org/plan';
/** A product whose plan repository is `PLAN`: three repositories of demo-org and one of another organisation. */
const SHOP: ProductState = { id: 'shop', repositories: [PLAN, 'demo-org/api', 'demo-org/web', 'other-org/ios'] };
/** The installation holds the repositories of demo-org; the App's other installation holds `other-org`'s. */
const INSTALLED: Record<string, Installed> = { 'other-org/ios': OTHER_INSTALLATION };
const RUNNER: RunnerRow = runnerRow({ id: SHARED, name: 'shared', slots: 1, github_app: true, repos: [PLAN, 'demo-org/app', 'demo-org/api'] });

const keyJob = (more: Partial<JobRow> = {}) => jobRow({ sent_by: OLGA, sent_by_key: API_KEY, line: '/omni:mega-bug-fix #12', repo: PLAN, ...more });
const running = (more: Partial<JobRow> = {}) => keyJob({ status: 'running', runner_id: SHARED, claimed_at: T0.toISOString(), running_at: T0.toISOString(), ...more });

/** The service on the fake store: the key (with the allow-list `repos`), the products, and which installation holds what. */
function world({ jobs, repos = [], products = [SHOP], installed = INSTALLED }: {
  jobs: JobRow[]; repos?: string[]; products?: ProductState[]; installed?: Record<string, Installed>;
}) {
  let now = T0;
  const keys: KeyState[] = [{ id: API_KEY, app: KEY_APP, working: true, repos }];
  const { store, state, products: productsOf } = fakeStore({ jobs, runners: [RUNNER], keys, products, now: () => now });
  const stub = stubGithub({}, installed);
  // A held `next` moves the clock as it sleeps, so it ends after its 40 s with no job.
  const clock = { now: () => now, sleep: (ms: number) => { now = new Date(now.getTime() + ms); return Promise.resolve(); } };
  return { service: runnersService(store, clock, stub.deps, undefined, productsOf), state, asked: stub.asked };
}

/** The repositories each minted token reaches, in the order asked. */
const mintedFor = (asked: ReturnType<typeof stubGithub>['asked']) => asked.minted.map((minted) => minted.repositories);

const value = <T>(served: { ok: true; value: T } | { ok: false; kind: string; error: string }): T => {
  if (!served.ok) throw new Error(`refused: ${served.kind} ${served.error}`);
  return served.value;
};

describe('a mega bug fix\'s token', () => {
  it('covers its plan repository and the other repositories of its product that the installation holds', async () => {
    const w = world({ jobs: [keyJob()] });
    value(await w.service.next(OLGA, SHARED));
    expect(mintedFor(w.asked)).toEqual([[PLAN, 'demo-org/api', 'demo-org/web']]);
  });

  it('names the plan repository once, though its product names it too, and first', async () => {
    const w = world({ jobs: [keyJob()], products: [{ id: 'shop', repositories: ['demo-org/web', PLAN, 'demo-org/web'] }] });
    value(await w.service.next(OLGA, SHARED));
    expect(mintedFor(w.asked)).toEqual([[PLAN, 'demo-org/web']]);
  });

  it('is as wide again when the mega bug fix runs again with answers', async () => {
    const w = world({ jobs: [keyJob({ line: '/omni:mega-bug-fix #12 --answers 00000000-0000-4000-8000-000000000001' })] });
    value(await w.service.next(OLGA, SHARED));
    expect(mintedFor(w.asked)).toEqual([[PLAN, 'demo-org/api', 'demo-org/web']]);
  });

  it('leaves out a repository of its product that the installation does not hold, whatever GitHub says of it', async () => {
    const w = world({ jobs: [keyJob()], installed: { 'demo-org/api': null, 'other-org/ios': OTHER_INSTALLATION } });
    value(await w.service.next(OLGA, SHARED));
    expect(mintedFor(w.asked)).toEqual([[PLAN, 'demo-org/web']]);
  });

  it('covers only its plan repository when its repository is in no product', async () => {
    const w = world({ jobs: [keyJob()], products: [] });
    value(await w.service.next(OLGA, SHARED));
    expect(mintedFor(w.asked)).toEqual([[PLAN]]);
  });

  it('ignores the repositories of an archived product', async () => {
    const w = world({ jobs: [keyJob()], products: [{ ...SHOP, archived: true }] });
    value(await w.service.next(OLGA, SHARED));
    expect(mintedFor(w.asked)).toEqual([[PLAN]]);
  });

  it('covers only its plan repository when the installation holds none of the others', async () => {
    const w = world({ jobs: [keyJob()], installed: { 'demo-org/api': null, 'demo-org/web': null, 'other-org/ios': null } });
    value(await w.service.next(OLGA, SHARED));
    expect(mintedFor(w.asked)).toEqual([[PLAN]]);
  });

  it('is asked of GitHub once for each repository, then minted once, on the plan repository\'s installation', async () => {
    const w = world({ jobs: [keyJob()] });
    value(await w.service.next(OLGA, SHARED));
    expect(w.asked.installations).toEqual([PLAN, 'demo-org/api', 'demo-org/web', 'other-org/ios']);
    expect(w.asked.minted.map((minted) => minted.installation)).toEqual([9001]);
  });

  it('is as wide at a refresh as at the claim', async () => {
    const w = world({ jobs: [running()] });
    value(await w.service.githubToken(OLGA, w.state.jobs[0]?.id ?? ''));
    expect(mintedFor(w.asked)).toEqual([[PLAN, 'demo-org/api', 'demo-org/web']]);
  });

  it('is refused at a refresh for want of GitHub\'s word on one of the repositories, for the runner to try again', async () => {
    const down = new Error('GitHub answered 502 to GET /repos/demo-org/web/installation');
    const w = world({ jobs: [running()], installed: { ...INSTALLED, 'demo-org/web': down } });
    expect(await w.service.githubToken(OLGA, w.state.jobs[0]?.id ?? '')).toEqual({ ok: false, kind: 'unavailable', error: down.message });
    expect(w.asked.minted).toEqual([]);
  });

  it('ends the job failed at the claim, with GitHub\'s words, when GitHub cannot say whether the installation holds one of them', async () => {
    const down = new Error('GitHub answered 502 to GET /repos/demo-org/web/installation');
    const w = world({ jobs: [keyJob()], installed: { ...INSTALLED, 'demo-org/web': down } });
    expect(value(await w.service.next(OLGA, SHARED))).toBeNull();
    expect(w.state.jobs[0]).toMatchObject({ status: 'failed', reason: `github app: ${down.message}` });
    expect(w.asked.minted).toEqual([]);
  });
});

describe('the token never reaches beyond the key\'s allowed repositories (BR-PRODUCT-63)', () => {
  it.each([
    ['no list: every repository of the workspace', [], [PLAN, 'demo-org/api', 'demo-org/web']],
    ['the plan repository alone', [PLAN], [PLAN]],
    ['the plan repository and one more', [PLAN, 'demo-org/api'], [PLAN, 'demo-org/api']],
    ['a repository of another organisation the installation does not hold, and one it does', [PLAN, 'other-org/ios', 'demo-org/web'], [PLAN, 'demo-org/web']],
    ['repositories of the product the list does not name', [PLAN, 'demo-org/unrelated'], [PLAN]],
  ])('mints for %s only, and asks GitHub about nothing else', async (_, allowed, minted) => {
    const w = world({ jobs: [keyJob()], repos: allowed });
    value(await w.service.next(OLGA, SHARED));
    expect(mintedFor(w.asked)).toEqual([minted]);
    if (allowed.length > 0) for (const repo of w.asked.installations) expect(allowed).toContain(repo);
  });

  it('holds at a refresh, whatever the list is', async () => {
    const w = world({ jobs: [running()], repos: [PLAN, 'demo-org/web'] });
    value(await w.service.githubToken(OLGA, w.state.jobs[0]?.id ?? ''));
    expect(mintedFor(w.asked)).toEqual([[PLAN, 'demo-org/web']]);
    expect(w.asked.installations).toEqual([PLAN, 'demo-org/web']);
  });

  it('keeps a bug fix to its own repository, in a product or not, for it is no mega bug fix', async () => {
    const w = world({ jobs: [keyJob({ line: '/omni:bug-fix 2433' })] });
    value(await w.service.next(OLGA, SHARED));
    expect(mintedFor(w.asked)).toEqual([[PLAN]]);
    expect(w.asked.installations).toEqual([PLAN]);
  });

  it('refuses a job whose own repository is outside the list: it ends failed, and GitHub is asked for nothing', async () => {
    const w = world({ jobs: [keyJob({ line: '/omni:bug-fix 2433', repo: 'demo-org/app' })], repos: [PLAN] });
    expect(value(await w.service.next(OLGA, SHARED))).toBeNull();
    expect(w.state.jobs[0]).toMatchObject({ status: 'failed', reason: 'github app: the API key may not reach demo-org/app' });
    expect(w.asked).toEqual({ bots: 0, installations: [], minted: [] });
  });

  it('refuses a refresh for a job whose own repository is outside the list, with the same words', async () => {
    const w = world({ jobs: [running({ line: '/omni:bug-fix 2433', repo: 'demo-org/app' })], repos: [PLAN] });
    expect(await w.service.githubToken(OLGA, w.state.jobs[0]?.id ?? '')).toEqual({ ok: false, kind: 'conflict', error: 'the API key may not reach demo-org/app' });
    expect(w.asked.minted).toEqual([]);
  });
});

// A job sent from the page has no key, so no allow-list: its repository was checked against its workspace when it was sent,
// and a mega bug fix of it reaches its product's other repositories that the installation holds (PRD 2573 s1).
describe('a mega bug fix sent from the page', () => {
  const pageJob = (more: Partial<JobRow> = {}) => keyJob({ sent_by_key: null, ...more });

  it('covers its plan repository and the other repositories of its product that the installation holds, reading no key', async () => {
    const w = world({ jobs: [pageJob()] });
    value(await w.service.next(OLGA, SHARED));
    expect(mintedFor(w.asked)).toEqual([[PLAN, 'demo-org/api', 'demo-org/web']]);
    expect(w.state.calls.filter((call) => call.startsWith('app of job'))).toEqual([]);
  });

  it('covers only its plan repository when its repository is in no product, or its product is archived', async () => {
    const none = world({ jobs: [pageJob()], products: [] });
    value(await none.service.next(OLGA, SHARED));
    const archived = world({ jobs: [pageJob()], products: [{ ...SHOP, archived: true }] });
    value(await archived.service.next(OLGA, SHARED));
    expect([...mintedFor(none.asked), ...mintedFor(archived.asked)]).toEqual([[PLAN], [PLAN]]);
  });

  it('is as wide at a refresh as at the claim', async () => {
    const w = world({ jobs: [running({ sent_by_key: null })] });
    value(await w.service.githubToken(OLGA, w.state.jobs[0]?.id ?? ''));
    expect(mintedFor(w.asked)).toEqual([[PLAN, 'demo-org/api', 'demo-org/web']]);
  });

  it('keeps a bug fix sent from the page to its own repository, and reads no product for it', async () => {
    const w = world({ jobs: [pageJob({ line: '/omni:bug-fix 2433' })] });
    value(await w.service.next(OLGA, SHARED));
    expect(mintedFor(w.asked)).toEqual([[PLAN]]);
    expect(w.asked.installations).toEqual([PLAN]);
  });
});

describe('the product repositories of a repository, as the database reads them', () => {
  const read = {
    products: [{ id: 'shop', archived_at: null }, { id: 'old', archived_at: '2026-10-01T00:00:00Z' }, { id: 'docs', archived_at: null }],
    links: [
      { product_id: 'shop', repository: 'demo-org/plan' }, { product_id: 'shop', repository: 'demo-org/web' }, { product_id: 'shop', repository: 'demo-org/api' },
      { product_id: 'shop', repository: 'demo-org/gone' },
      { product_id: 'old', repository: 'demo-org/plan' }, { product_id: 'old', repository: 'demo-org/legacy' },
      { product_id: 'docs', repository: 'demo-org/site' },
    ],
    repositories: ['demo-org/plan', 'Demo-Org/Web', 'demo-org/api', 'demo-org/legacy', 'demo-org/site'],
  };

  it('are every repository of the live products that name it, lower case, sorted, once each, the job\'s own among them', () => {
    expect(productReposOf(read, 'Demo-Org/Plan')).toEqual(['demo-org/api', 'demo-org/plan', 'demo-org/web']);
  });

  it('leave out an archived product\'s, and a repository the workspace no longer lists', () => {
    expect(productReposOf(read, 'demo-org/plan')).not.toContain('demo-org/legacy');
    expect(productReposOf(read, 'demo-org/plan')).not.toContain('demo-org/gone');
  });

  it('are none for a repository in no live product', () => {
    expect(productReposOf(read, 'demo-org/legacy')).toEqual([]);
    expect(productReposOf(read, 'demo-org/unknown')).toEqual([]);
  });
});
