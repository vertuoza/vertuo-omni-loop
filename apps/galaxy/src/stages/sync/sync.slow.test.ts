import { describe, expect, it, vi } from 'vitest';
import { fakeConceptFactsStore, fakeFixFactsStore } from '../../fixes/facts/store.fake';
import { fakeStageStore } from '../store.fake';
import { syncConfig, type RepoSnapshot } from './core';
import { syncStages, type SnapshotSyncDeps, type SyncDeps, type SyncWorkspace } from './sync';
import { parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { createLogger } from 'omni-loop/kit/lib/log/log.ts';

vi.mock('server-only', () => ({}));

// The stages sync logs each step that takes 30 s or more (#2529), so a run cut off at 300 s still says what
// was slow; it refreshes a repository's stale snapshots three at a time, and none once the run has taken 200 s. On the store's fake, a fake reader and a fake stopwatch: never GitHub, never a database.

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

describe('the stages sync refreshes stale snapshots in turns, within its time (#2529)', () => {
  /** `count` stale snapshots of acme/widgets, each refresh moving the stopwatch `refreshMs`; the repository's
   * snapshot read takes `startMs`, so its refreshes start that far into the run. */
  function withStale(count: number, { refreshMs = 0, startMs = 0 }: { refreshMs?: number; startMs?: number } = {}) {
    const setup = run({ 'acme/widgets': 0 });
    let clock = 0;
    const refreshed: string[] = [];
    let refreshing = 0;
    let most = 0;
    const stale = Array.from({ length: count }, (_, i) => ({ id: `d${String(i + 1)}`, home_repo: 'acme/widgets', prd: parsePrd(i + 1) }));
    const net: SnapshotSyncDeps = {
      markChanged: () => Promise.resolve(),
      markOld: () => Promise.resolve(),
      stale: () => Promise.resolve(stale),
      refresh: async (_w, dossier) => {
        refreshing += 1;
        most = Math.max(most, refreshing);
        await new Promise((resolve) => setTimeout(resolve, 2));
        clock += refreshMs;
        refreshed.push(dossier.id);
        refreshing -= 1;
      },
      dropEtags: () => Promise.resolve(),
    };
    setup.deps.snapshots = net;
    setup.deps.snapshot = (_w, repo) => {
      clock += startMs;
      return Promise.resolve(snap(repo));
    };
    setup.deps.timer = () => {
      const start = clock;
      return () => clock - start;
    };
    return { ...setup, refreshed, most: () => most };
  }

  it('refreshes a repository\'s stale snapshots three at a time, every one of them', async () => {
    const { deps, refreshed, most } = withStale(7);
    expect((await syncStages(post(), deps)).status).toBe(200);
    expect(most()).toBe(3);
    expect(refreshed.toSorted()).toEqual(['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7']);
  });

  it('starts no refresh once the run has taken 200 s, and says how many wait for the next run', async () => {
    const { deps, refreshed, lines } = withStale(5, { startMs: 200_000 });
    expect((await syncStages(post(), deps)).status).toBe(200);
    expect(refreshed).toEqual([]);
    expect(lines).toContain('stages sync: 5 stale snapshots of acme/widgets wait for the next run');
  });

  it('stops starting refreshes when the run reaches 200 s midway, and keeps the rest for the next run', async () => {
    const { deps, refreshed, lines } = withStale(9, { startMs: 150_000, refreshMs: 20_000 });
    await syncStages(post(), deps);
    // Three start at 150 s; each end moves the run 20 s, so the 4th starts at 170 s, the 5th at 190 s, and none from 210 s.
    expect(refreshed).toHaveLength(5);
    expect(lines).toContain('stages sync: 4 stale snapshots of acme/widgets wait for the next run');
  });

  it('refreshes every stale snapshot without a stopwatch', async () => {
    const { deps, refreshed } = withStale(5, { startMs: 500_000 });
    delete deps.timer;
    await syncStages(post(), deps);
    expect(refreshed).toHaveLength(5);
  });
});

describe('the stages sync starts no repository once it has taken 120 s (#2529)', () => {
  const names = (count: number) => Array.from({ length: count }, (_, i) => `acme/r${String(i + 1)}`);
  const reads = (count: number, ms: number) => Object.fromEntries(names(count).map((name) => [name, ms]));

  it('starts no repository from 120 s, and names those that wait for the next run', async () => {
    // The first four start at 0 s; the first one's read takes 130 s, so none starts after them.
    const { deps, lines } = run({ ...reads(9, 0), 'acme/r1': 130_000 });
    const answer = (await (await syncStages(post(), deps)).json()) as { repositories: { repository: string }[]; skipped: unknown[] };
    expect(answer.repositories.map((r) => r.repository)).toEqual(names(4));
    expect(answer.skipped).toEqual([]);
    expect(lines).toContain('stages sync: 5 repositories of acme wait for the next run — acme/r5, acme/r6, acme/r7, acme/r8, acme/r9');
  });

  it('reads the repositories synced longest ago first, the never-synced ones before all', async () => {
    // r1 and r2 were synced, r1 last; the four never synced start first, and r3's read takes 130 s.
    const { deps, lines } = run({ ...reads(6, 0), 'acme/r3': 130_000 });
    const synced = (repository: string, at: string) =>
      deps.store.recordStages([{ workspace_id: ACME.id, repository, prd: parsePrd(1), stage: 'prd', reached_at: NOW }], at);
    await synced('acme/r1', '2026-10-27T11:00:00.000Z');
    await synced('acme/r2', '2026-10-27T10:00:00.000Z');
    await syncStages(post(), deps);
    expect(lines).toContain('stages sync: 2 repositories of acme wait for the next run — acme/r2, acme/r1');
  });

  it('reads first the workspace whose oldest repository waited longest, so a slow one never keeps it out', async () => {
    // Clement's one repository was synced last and its read takes 130 s; read first, it would leave none of
    // acme's for this run, as on 2026-10-28 08:15 UTC.
    const CLEMENT: SyncWorkspace = { id: 'w-clement', slug: 'clement', github_org: 'clement', github_installation_id: 12 };
    const { deps, lines } = run({ 'clement/slow': 130_000, ...reads(2, 0) });
    deps.workspaces = () => Promise.resolve([CLEMENT, ACME]);
    deps.repositories = (workspace) => Promise.resolve(workspace.id === CLEMENT.id ? ['clement/slow'] : names(2));
    const synced = (workspace: string, repository: string, at: string) =>
      deps.store.recordStages([{ workspace_id: workspace, repository, prd: parsePrd(1), stage: 'prd', reached_at: NOW }], at);
    await synced(CLEMENT.id, 'clement/slow', '2026-10-27T11:00:00.000Z');
    await synced(ACME.id, 'acme/r1', '2026-10-27T10:00:00.000Z');
    await synced(ACME.id, 'acme/r2', '2026-10-27T10:00:00.000Z');
    const answer = (await (await syncStages(post(), deps)).json()) as { repositories: { repository: string }[] };
    expect(answer.repositories.map((r) => r.repository)).toEqual(['acme/r1', 'acme/r2', 'clement/slow']);
    expect(lines).not.toContainEqual(expect.stringContaining('wait for the next run'));
  });

  it('reads every repository without a stopwatch', async () => {
    const { deps } = run(reads(9, 50_000));
    delete deps.timer;
    const answer = (await (await syncStages(post(), deps)).json()) as { repositories: unknown[] };
    expect(answer.repositories).toHaveLength(9);
  });
});

describe('the stages sync reaches every repository in turn (#2963)', () => {
  const names = (count: number) => Array.from({ length: count }, (_, i) => `acme/r${String(i + 1)}`);

  it('reads next run the repositories that waited, ahead of the ones it read, though none holds a new PRD issue', async () => {
    // Eight quiet repositories: no PRD issue changed, so the sync writes no `prd` stage for any of them. r1's
    // read takes 130 s, so the first run reads r1–r4 and leaves r5–r8 for the next one, as on 2026-11-16, when
    // a repository holding a new PRD waited behind quiet repositories run after run.
    const { deps, lines } = run({ ...Object.fromEntries(names(8).map((name) => [name, 0])), 'acme/r1': 130_000 });
    const read = async (at: string) => {
      deps.now = () => at;
      const answer = (await (await syncStages(post(), deps)).json()) as { repositories: { repository: string }[] };
      return answer.repositories.map((r) => r.repository);
    };
    expect(await read('2026-10-27T12:00:00.000Z')).toEqual(names(4));
    expect(await read('2026-10-27T12:15:00.000Z')).toEqual(names(8).slice(4));
    expect(lines).toContain('stages sync: 4 repositories of acme wait for the next run — acme/r5, acme/r6, acme/r7, acme/r8');
  });
});

describe('the stages sync starts no fix or concept facts late in its run (#2963)', () => {
  it('leaves the fix and concept facts for the next run once the repositories took the run to 250 s, and says so', async () => {
    // A repository's read took the run to 250 s; the fix facts took 115 s on 2026-11-16 15:30 UTC, which ran
    // past the route's 300 s.
    const { deps, lines } = run({ 'acme/slow': 250_000 });
    const asked: string[] = [];
    const ref = (id: string) => ({ id, home_repo: 'acme/slow', prd: parsePrd(1) });
    deps.fixes = {
      dossiers: () => Promise.resolve([ref('f1')]),
      reader: { fix: (r) => { asked.push(r.id); return Promise.resolve(null); } },
      store: fakeFixFactsStore(() => NOW),
    };
    deps.concepts = {
      dossiers: () => Promise.resolve([ref('c1')]),
      reader: { concept: (r) => { asked.push(r.id); return Promise.resolve(null); } },
      store: fakeConceptFactsStore(() => NOW),
    };
    expect((await syncStages(post(), deps)).status).toBe(200);
    expect(asked).toEqual([]);
    expect(lines).toContain('stages sync: the fix and concept facts of acme wait for the next run');
  });
});
