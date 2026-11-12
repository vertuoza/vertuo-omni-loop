// Bug 638: pr-stats spent the installation's whole REST core budget (three calls per pull request
// through a 90-day backfill), and the outbox check, which shares that budget, failed with 403 for most
// of each hour. The collector must read pull requests without REST calls per pull request, and never
// drive a budget of the installation below half.
import { GithubDeferred } from '@omni/github';
import { parsePr } from 'omni-loop/kit/lib/ids.ts';
import { describe, expect, it } from 'vitest';
import { assertDefined } from 'omni-loop/kit/test/assert.ts';
import type { Finish, JobLedger } from '../jobs/ledger.ts';
import { runDue } from '../jobs/worker.ts';
import { collectThroughJob, fakeGitHub, fakeStore, prStatsJob, pull } from './fake.ts';
import { PR_STATS_KIND, prStatsHandler } from './job.ts';

const NOW = Date.parse('2026-09-29T12:00:00Z');
const WS = 'ws-vertuoza';
const daysAgo = (days: number) => new Date(NOW - days * 24 * 60 * 60 * 1000).toISOString();

/** `count` pull requests of the last 60 days, each updated at an instant of its own. */
const recentPulls = (count: number) => Array.from({ length: count }, (_, index) => pull(parsePr(index + 1), { updated_at: daysAgo(60 - index * 0.1) }));

/** One run of a claimed `pr-stats` job (PRD omni-loop-3 s2): the summary its last line says. */
async function run(github: ReturnType<typeof fakeGitHub>, store: ReturnType<typeof fakeStore>) {
  const ran = await collectThroughJob({ store, github, now: NOW });
  expect(ran.result).toEqual({ outcome: 'done' });
  assertDefined(ran.summary, 'the summary line');
  return ran.summary;
}

describe('prStats — the installation budget the outbox check shares (bug 638)', () => {
  it('collects 200 pull requests without one REST call per pull request', async () => {
    const github = fakeGitHub({ 'demo-org/apps': { pulls: recentPulls(200) } });
    const store = fakeStore([{ workspaceId: WS, installationId: 7, fullName: 'demo-org/apps' }]);

    await run(github, store);

    expect(store.state.pulls.size).toBe(200);
    expect(github.requests.map((request) => request.route)).toEqual([]);
    expect(github.budget.core.remaining).toBe(github.budget.core.limit);
  });

  it('never drives a budget below half, and leaves the cursor at what it wrote', async () => {
    const budgets = { core: { limit: 5000, remaining: 2520 }, graphql: { limit: 5000, remaining: 2520 } };
    const github = fakeGitHub({ 'demo-org/apps': { pulls: recentPulls(600) }, 'demo-org/web': { pulls: recentPulls(5) } }, budgets);
    const store = fakeStore([
      { workspaceId: WS, installationId: 7, fullName: 'demo-org/apps' },
      { workspaceId: WS, installationId: 7, fullName: 'demo-org/web' },
    ]);

    await run(github, store);

    expect(github.budget.core.remaining).toBeGreaterThanOrEqual(2500);
    expect(github.budget.graphql.remaining).toBeGreaterThanOrEqual(2500);
    const [apps, web] = store.state.repositories as [(typeof store.state.repositories)[number], (typeof store.state.repositories)[number]];
    expect(apps.collectError).toBeNull();
    expect(apps.collectedAt).toBeNull();
    const saved = [...store.state.pulls.values()].filter((row) => row.repo === 'demo-org/apps').map((row) => row.number);
    expect(saved.length).toBeLessThan(600);
    expect(apps.collectedUntil).toBe(saved.length ? daysAgo(60 - (saved.length - 1) * 0.1) : daysAgo(90));
    expect(web.collectedAt).toBeNull();
  });

  it('reads nothing when a budget is already under half', async () => {
    const budgets = { core: { limit: 5000, remaining: 2000 }, graphql: { limit: 5000, remaining: 2000 } };
    const github = fakeGitHub({ 'demo-org/apps': { pulls: recentPulls(3) } }, budgets);
    const store = fakeStore([{ workspaceId: WS, installationId: 7, fullName: 'demo-org/apps' }]);

    const result = await run(github, store);

    expect(store.state.pulls.size).toBe(0);
    expect(github.budget.core.remaining).toBe(2000);
    expect(github.budget.graphql.remaining).toBeGreaterThanOrEqual(1999);
    expect(store.state.repositories[0]?.collectError).toBeNull();
    expect(result.paused).toBe(1);
  });
});

describe('prStats — a budget the shared client refuses is waiting (PRD omni-loop-3 s2)', () => {
  it('ends the job waiting, its try given back, each cursor at what was written and no error recorded', async () => {
    const github = fakeGitHub({ 'demo-org/apps': { pulls: recentPulls(3) }, 'demo-org/web': { pulls: recentPulls(2) } });
    const store = fakeStore([
      { workspaceId: WS, installationId: 7, fullName: 'demo-org/apps' },
      { workspaceId: WS, installationId: 7, fullName: 'demo-org/web' },
    ]);
    const deferred = new GithubDeferred(NOW + 15 * 60_000);
    const octokit = {
      graphql: (query: string, variables?: Record<string, unknown>) =>
        variables?.repo === 'web' ? Promise.reject(new Error('Request failed', { cause: deferred })) : github.octokit.graphql(query, variables),
    };
    const finishes: Finish[] = [];
    const jobs = [prStatsJob()];
    const ledger: JobLedger = {
      claim: () => Promise.resolve(jobs.splice(0, 1)),
      finish: (finish) => {
        finishes.push(finish);
        return Promise.resolve('queued');
      },
    };
    const handler = prStatsHandler({ octokitFor: () => octokit, supabase: { url: 'https://db.example', key: 'service-key' }, storeFor: () => store, log: () => undefined, clock: () => NOW });

    const summary = await runDue({ ledger, handlers: { [PR_STATS_KIND]: handler }, clock: () => NOW, log: () => undefined });

    expect(summary).toMatchObject({ ran: 1, waiting: 1, failed: 0, retry: 0 });
    expect(finishes).toEqual([expect.objectContaining({ outcome: 'waiting', reason: deferred.message })]);
    const [apps, web] = store.state.repositories as [(typeof store.state.repositories)[number], (typeof store.state.repositories)[number]];
    expect(apps.collectedAt).toBe(new Date(NOW).toISOString());
    expect(store.state.pulls.size).toBe(3);
    expect(web.collectError).toBeNull();
    expect(web.collectedAt).toBeNull();
    expect(web.collectedUntil).toBe(daysAgo(90));
  });
});
