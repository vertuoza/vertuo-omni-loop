// The Engineering board's collector as a job of the ledger (PRD omni-loop-3 s2): the schedule adds it every 15
// minutes, in its own lane, with 3 tries; a claimed job collects as the `prStats` Inngest function did.
import { parsePr } from 'omni-loop/kit/lib/ids.ts';
import { describe, expect, it, vi } from 'vitest';
import { readEnv } from '../env.ts';
import { liveWorkers } from '../jobs/pr-checks.ts';
import { SCHEDULES, scheduledJobs } from '../jobs/schedule.ts';
import { stdoutLines } from '../run-log/capture.ts';
import { collectThroughJob, fakeGitHub, fakeStore, prStatsJob, pull } from './fake.ts';
import { PR_STATS_KIND, prStatsHandler } from './job.ts';

const NOW = Date.parse('2026-09-29T12:00:00Z');
const ENV = { SUPABASE_URL: 'https://db.example', SUPABASE_SERVICE_ROLE_KEY: 'service-key' };
const SUPABASE = readEnv(ENV).supabase;

describe('pr-stats — the job of the schedule', () => {
  it('is added every 15 minutes, one job per slot, in its own lane, with 3 tries', () => {
    expect(SCHEDULES).toContainEqual({ kind: PR_STATS_KIND, periodMinutes: 15, maxTries: 3 });
    const jobs = scheduledJobs(SCHEDULES, Date.parse('2026-09-29T12:20:00Z')).filter((job) => job.kind === PR_STATS_KIND);
    expect(jobs).toEqual([{ kind: 'pr-stats', key: 'pr-stats@2026-09-29T12:15:00.000Z', subject: 'pr-stats', payload: { slot: '2026-09-29T12:15:00.000Z' }, lane: 'pr-stats', maxTries: 3 }]);
  });

  it('has a handler in the worker every runner of the ledger runs', () => {
    const { handlers } = liveWorkers({ supabase: { url: ENV.SUPABASE_URL, key: ENV.SUPABASE_SERVICE_ROLE_KEY } }, () => Promise.reject(new Error('unused')));
    expect(typeof handlers[PR_STATS_KIND]).toBe('function');
  });

  it('collects every tracked repository of every installed workspace, through each installation', async () => {
    const github = fakeGitHub({ 'demo-org/apps': { pulls: [pull(parsePr(1), { updated_at: '2026-09-28T10:00:00Z' })] }, 'acme/web': { pulls: [pull(parsePr(4), { updated_at: '2026-09-27T10:00:00Z' })] } });
    const store = fakeStore([
      { workspaceId: 'ws-vertuoza', installationId: 7, fullName: 'demo-org/apps' },
      { workspaceId: 'ws-acme', installationId: 9, fullName: 'acme/web' },
    ]);
    const octokitFor = vi.fn<(installationId: number) => Promise<typeof github.octokit>>(() => Promise.resolve(github.octokit));
    const storeFor = vi.fn(() => store);
    const lines: string[] = [];
    const handler = prStatsHandler({ octokitFor, supabase: SUPABASE, storeFor, log: (line) => lines.push(line), clock: () => NOW });

    const result = await handler(prStatsJob());

    expect(result).toEqual({ outcome: 'done' });
    expect(storeFor).toHaveBeenCalledWith({ url: ENV.SUPABASE_URL, key: ENV.SUPABASE_SERVICE_ROLE_KEY });
    expect(octokitFor.mock.calls.map(([id]) => id).sort()).toEqual([7, 9]);
    expect(lines).toEqual(['pr-stats: 2 repositories: 2 collected, 0 failed, 0 unfinished, 0 paused; 2 pull requests saved']);
    expect([...store.state.pulls.keys()].sort()).toEqual(['ws-acme|acme/web|4', 'ws-vertuoza|demo-org/apps|1']);
  });

  it('writes the same rows when its job runs twice', async () => {
    const github = fakeGitHub({ 'demo-org/apps': { pulls: [pull(parsePr(1), { updated_at: '2026-09-28T10:00:00Z' })] } });
    const store = fakeStore([{ workspaceId: 'ws-vertuoza', installationId: 7, fullName: 'demo-org/apps' }]);
    await collectThroughJob({ store, github, now: NOW });
    const first = structuredClone({ pulls: [...store.state.pulls], reviews: [...store.state.reviews], repositories: store.state.repositories });
    await collectThroughJob({ store, github, now: NOW });
    expect({ pulls: [...store.state.pulls], reviews: [...store.state.reviews], repositories: store.state.repositories }).toEqual(first);
  });

  it('says it by default as a JSON note line at warn, today’s sentence as its message (PRD 1723 s6)', async () => {
    const handler = prStatsHandler({ octokitFor: vi.fn(), supabase: readEnv({}).supabase, storeFor: vi.fn() });
    const lines = await stdoutLines(() => handler(prStatsJob()));
    expect(lines.filter((line) => line.event === 'note')).toEqual([
      { level: 'warn', event: 'note', fn: 'pr-stats', message: 'prStats: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not set, so nothing is collected.' },
    ]);
  });

  it('logs one line, writes nothing and ends skipped when the Supabase pair is not set', async () => {
    const log = vi.fn();
    const storeFor = vi.fn();
    const octokitFor = vi.fn();
    const handler = prStatsHandler({ octokitFor, supabase: readEnv({}).supabase, storeFor, log });

    const result = await handler(prStatsJob());

    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]?.[0]).toMatch(/SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/);
    expect(storeFor).not.toHaveBeenCalled();
    expect(octokitFor).not.toHaveBeenCalled();
    expect(result).toEqual({ outcome: 'skipped', reason: 'no store: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not set' });
  });
});
