// Bug 638: pr-stats spent the installation's whole REST core budget (three calls per pull request
// through a 90-day backfill), and the outbox check, which shares that budget, failed with 403 for most
// of each hour. The collector must read pull requests without REST calls per pull request, and never
// drive a budget of the installation below half.
import { describe, expect, it } from 'vitest';
import { type CollectStep, collectAll } from './collect.ts';
import { fakeGitHub, fakeStore, pull } from './fake.ts';

const NOW = Date.parse('2026-09-29T12:00:00Z');
const WS = 'ws-vertuoza';
/** Inngest's step, as these tests stub it: a step's value comes back as JSON, read again. */
const step: CollectStep = {
  run: async <T>(_id: string, fn: () => T | Promise<T>): Promise<T> => {
    const value: unknown = await fn();
    return JSON.parse(JSON.stringify(value ?? null)) as T;
  },
};
const daysAgo = (days: number) => new Date(NOW - days * 24 * 60 * 60 * 1000).toISOString();

/** `count` pull requests of the last 60 days, each updated at an instant of its own. */
const recentPulls = (count: number) => Array.from({ length: count }, (_, index) => pull(index + 1, { updated_at: daysAgo(60 - index * 0.1) }));

function run(github: ReturnType<typeof fakeGitHub>, store: ReturnType<typeof fakeStore>) {
  return collectAll({ store, octokitFor: () => Promise.resolve(github.octokit), step, now: NOW });
}

describe('prStats — the installation budget the outbox check shares (bug 638)', () => {
  it('collects 200 pull requests without one REST call per pull request', async () => {
    const github = fakeGitHub({ 'vertuoza/apps': { pulls: recentPulls(200) } });
    const store = fakeStore([{ workspaceId: WS, installationId: 7, fullName: 'vertuoza/apps' }]);

    await run(github, store);

    expect(store.state.pulls.size).toBe(200);
    expect(github.requests.map((request) => request.route)).toEqual([]);
    expect(github.budget.core.remaining).toBe(github.budget.core.limit);
  });

  it('never drives a budget below half, and leaves the cursor at what it wrote', async () => {
    const budgets = { core: { limit: 5000, remaining: 2520 }, graphql: { limit: 5000, remaining: 2520 } };
    const github = fakeGitHub({ 'vertuoza/apps': { pulls: recentPulls(600) }, 'vertuoza/web': { pulls: recentPulls(5) } }, budgets);
    const store = fakeStore([
      { workspaceId: WS, installationId: 7, fullName: 'vertuoza/apps' },
      { workspaceId: WS, installationId: 7, fullName: 'vertuoza/web' },
    ]);

    await run(github, store);

    expect(github.budget.core.remaining).toBeGreaterThanOrEqual(2500);
    expect(github.budget.graphql.remaining).toBeGreaterThanOrEqual(2500);
    const [apps, web] = store.state.repositories as [(typeof store.state.repositories)[number], (typeof store.state.repositories)[number]];
    expect(apps.collectError).toBeNull();
    expect(apps.collectedAt).toBeNull();
    const saved = [...store.state.pulls.values()].filter((row) => row.repo === 'vertuoza/apps').map((row) => row.number);
    expect(saved.length).toBeLessThan(600);
    expect(apps.collectedUntil).toBe(saved.length ? daysAgo(60 - (saved.length - 1) * 0.1) : daysAgo(90));
    expect(web.collectedAt).toBeNull();
  });

  it('reads nothing when a budget is already under half', async () => {
    const budgets = { core: { limit: 5000, remaining: 2000 }, graphql: { limit: 5000, remaining: 2000 } };
    const github = fakeGitHub({ 'vertuoza/apps': { pulls: recentPulls(3) } }, budgets);
    const store = fakeStore([{ workspaceId: WS, installationId: 7, fullName: 'vertuoza/apps' }]);

    const result = await run(github, store);

    expect(store.state.pulls.size).toBe(0);
    expect(github.budget.core.remaining).toBe(2000);
    expect(github.budget.graphql.remaining).toBeGreaterThanOrEqual(1999);
    expect(store.state.repositories[0]?.collectError).toBeNull();
    expect(result.paused).toBe(1);
  });
});
