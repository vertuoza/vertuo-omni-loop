import { describe, expect, it, vi } from 'vitest';
import { fakeStageStore } from '../store.fake';
import { syncConfig, type RepoSnapshot } from './core';
import { syncStages, type SyncDeps, type SyncWorkspace } from './sync';
import { createLogger } from 'omni-loop/kit/lib/log/log.ts';

vi.mock('server-only', () => ({}));

// The stages sync logs each step that takes 30 s or more (#2529), so a run cut off at 300 s still says what
// was slow. On the store's fake, a fake reader and a fake stopwatch: never GitHub, never a database.

const SECRET = 'sync-secret-0123456789';
const NOW = '2026-10-27T12:00:00.000Z';
const ACME: SyncWorkspace = { id: 'w-acme', slug: 'acme', github_org: 'acme', github_installation_id: 11 };

const snap = (repository: string): RepoSnapshot => ({
  repository, config: syncConfig(`kit: 1\nrepo:\n  slug: ${repository}\n`, repository), inbox: [], shipped: [], issues: [], pulls: [],
});

const post = () => new Request('http://galaxy.test/api/stages/sync', { method: 'POST', headers: { authorization: `Bearer ${SECRET}` } });

/** A run over the repositories whose snapshot read takes `readMs` each, on a stopwatch that moves only when a read does. */
function run(readMs: Record<string, number>, more: Partial<SyncDeps> = {}) {
  let clock = 0;
  const lines: string[] = [];
  const deps: SyncDeps = {
    secret: SECRET,
    workspaces: () => Promise.resolve([ACME]),
    repositories: () => Promise.resolve(Object.keys(readMs)),
    snapshot: (_w, repo) => {
      clock += readMs[repo] ?? 0;
      return Promise.resolve(snap(repo));
    },
    store: fakeStageStore(() => NOW),
    now: () => NOW,
    log: (line) => lines.push(line),
    timer: () => {
      const start = clock;
      return () => clock - start;
    },
    runLog: createLogger({ sink: () => {} }),
    ...more,
  };
  return { deps, lines };
}

describe('the stages sync names its slow steps (#2529)', () => {
  it('logs a repository and its snapshot read that took 30 s or more, with how long', async () => {
    const { deps, lines } = run({ 'acme/slow': 95_400 });
    expect((await syncStages(post(), deps)).status).toBe(200);
    expect(lines).toEqual(['stages sync: the snapshot of acme/slow took 95 s', 'stages sync: acme/slow took 95 s']);
  });

  it('logs nothing for a repository read in under 30 s', async () => {
    const { deps, lines } = run({ 'acme/fast': 29_999 });
    await syncStages(post(), deps);
    expect(lines).toEqual([]);
  });

  it('logs a step that took 30 s exactly', async () => {
    const { deps, lines } = run({ 'acme/edge': 30_000 });
    await syncStages(post(), deps);
    expect(lines).toEqual(['stages sync: the snapshot of acme/edge took 30 s', 'stages sync: acme/edge took 30 s']);
  });

  it('logs a slow repository that is skipped too, beside why', async () => {
    let clock = 0;
    const { deps, lines } = run({ 'acme/broken': 0 }, {
      snapshot: () => {
        clock += 40_000;
        return Promise.reject(new Error('GitHub answered 502 to /pulls'));
      },
      timer: () => {
        const start = clock;
        return () => clock - start;
      },
    });
    await syncStages(post(), deps);
    expect(lines).toEqual([
      'stages sync: the snapshot of acme/broken took 40 s',
      'stages sync: acme/broken took 40 s',
      'stages sync: acme/broken of acme is skipped — GitHub answered 502 to /pulls',
    ]);
  });

  it('times nothing without a stopwatch', async () => {
    const { deps, lines } = run({ 'acme/slow': 95_000 });
    delete deps.timer;
    await syncStages(post(), deps);
    expect(lines).toEqual([]);
  });
});
