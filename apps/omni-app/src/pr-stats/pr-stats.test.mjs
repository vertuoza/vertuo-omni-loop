import { InngestTestEngine } from '@inngest/test';
import { internalEvents } from 'inngest';
import { describe, expect, it, vi } from 'vitest';
import { inngest } from '../inngest-client.mjs';
import { fakeGitHub, fakeStore, pull } from './fake.mjs';
import { createPrStats, EVERY_15_MINUTES, PR_STATS_FUNCTION_ID, prStats } from './pr-stats.mjs';

const NOW = Date.parse('2026-09-29T12:00:00Z');
const tick = { name: internalEvents.ScheduledTimer, data: { cron: EVERY_15_MINUTES } };
const ENV = { SUPABASE_URL: 'https://db.example', SUPABASE_SERVICE_ROLE_KEY: 'service-key' };

function engine(fn) {
  return new InngestTestEngine({ function: fn, events: [tick] });
}

describe('prStats — the Inngest function', () => {
  it('runs every 15 minutes, on no event', () => {
    expect(EVERY_15_MINUTES).toBe('*/15 * * * *');
    expect(prStats.id()).toBe(PR_STATS_FUNCTION_ID);
    expect(prStats.opts.triggers).toEqual([{ cron: '*/15 * * * *' }]);
  });

  it('collects every tracked repository of every installed workspace, through each installation', async () => {
    const github = fakeGitHub({ 'vertuoza/apps': { pulls: [pull(1, { updated_at: '2026-09-28T10:00:00Z' })] }, 'acme/web': { pulls: [pull(4, { updated_at: '2026-09-27T10:00:00Z' })] } });
    const store = fakeStore([
      { workspaceId: 'ws-vertuoza', installationId: 7, fullName: 'vertuoza/apps' },
      { workspaceId: 'ws-acme', installationId: 9, fullName: 'acme/web' },
    ]);
    const octokitFor = vi.fn(async () => github.octokit);
    const storeFor = vi.fn(() => store);
    const fn = createPrStats({ client: inngest, octokitFor, env: ENV, storeFor, clock: () => NOW });

    const { result, error } = await engine(fn).execute();

    expect(error).toBeUndefined();
    expect(storeFor).toHaveBeenCalledWith({ url: ENV.SUPABASE_URL, key: ENV.SUPABASE_SERVICE_ROLE_KEY });
    expect(octokitFor.mock.calls.map(([id]) => id).sort()).toEqual([7, 9]);
    expect(result).toMatchObject({ repositories: 2, collected: 2, failed: 0, saved: 2 });
    expect([...store.state.pulls.keys()].sort()).toEqual(['ws-acme|acme/web|4', 'ws-vertuoza|vertuoza/apps|1']);
  });

  for (const unset of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
    it(`logs one line and writes nothing when ${unset} is not set`, async () => {
      const log = vi.fn();
      const storeFor = vi.fn();
      const octokitFor = vi.fn();
      const fn = createPrStats({ client: inngest, octokitFor, env: { ...ENV, [unset]: '' }, storeFor, log });

      const { result, error } = await engine(fn).execute();

      expect(error).toBeUndefined();
      expect(log).toHaveBeenCalledTimes(1);
      expect(log.mock.calls[0][0]).toMatch(/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/);
      expect(storeFor).not.toHaveBeenCalled();
      expect(octokitFor).not.toHaveBeenCalled();
      expect(result).toEqual({ skipped: 'no store' });
    });
  }
});
