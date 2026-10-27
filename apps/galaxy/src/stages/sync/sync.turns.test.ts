import { describe, expect, it, vi } from 'vitest';
import { fakeStageStore } from '../store.fake';
import { syncConfig, type RepoSnapshot } from './core';
import { syncStages, type SyncWorkspace } from './sync';
import { createLogger } from 'omni-loop/kit/lib/log/log.ts';

vi.mock('server-only', () => ({}));

// The stages sync reads a workspace's repositories four at a time (#2529): one after another, 22 of them
// overran the route's 300 s. On the store's fake and a fake reader: never GitHub, never a database.

const SECRET = 'sync-secret-0123456789';
const NOW = '2026-10-27T12:00:00.000Z';
const ACME: SyncWorkspace = { id: 'w-acme', slug: 'acme', github_org: 'acme', github_installation_id: 11 };

const snap = (repository: string): RepoSnapshot => ({
  repository, config: syncConfig(`kit: 1\nrepo:\n  slug: ${repository}\n`, repository), inbox: [], shipped: [], issues: [], pulls: [],
});

describe('the stages sync reads repositories in turns (#2529)', () => {
  it('reads a workspace\'s repositories four at a time, so a run of many fits its time, and answers them in order', async () => {
    const names = ['acme/a1', 'acme/a2', 'acme/a3', 'acme/a4', 'acme/a5', 'acme/a6'];
    let reading = 0;
    let most = 0;
    const res = await syncStages(new Request('http://galaxy.test/api/stages/sync', { method: 'POST', headers: { authorization: `Bearer ${SECRET}` } }), {
      secret: SECRET,
      workspaces: () => Promise.resolve([ACME]),
      repositories: () => Promise.resolve(names),
      snapshot: async (_w, repo) => {
        reading += 1;
        most = Math.max(most, reading);
        // The first repository is the slowest, so it finishes last.
        await new Promise((resolve) => setTimeout(resolve, repo === 'acme/a1' ? 20 : 5));
        reading -= 1;
        return snap(repo);
      },
      store: fakeStageStore(() => NOW),
      now: () => NOW,
      log: () => {},
      runLog: createLogger({ sink: () => {} }),
    });
    const body = (await res.json()) as { repositories: { repository: string }[] };
    expect(most).toBe(4);
    expect(body.repositories.map((r) => r.repository)).toEqual(names);
  });
});
