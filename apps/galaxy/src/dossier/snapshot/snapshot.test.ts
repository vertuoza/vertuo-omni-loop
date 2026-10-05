import { describe, expect, it, vi } from 'vitest';
import type { Priority } from '@omni/github';
import { UNREAD, type GithubSummary } from '../github/summary';
import type { DossierRef } from '../github/reader';
import { parseIssue, parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { LEASE_MS, mergeSummary, pageSnapshot, recountSnapshot, refreshSnapshot, sendSnapshot, staleSnapshot, type SnapshotDeps } from './snapshot';
import { fakeSnapshotStore, type FakeSnapshotStore } from './store.fake';
import { StoredSummary } from './schema';

// Pages read a snapshot (PRD 902, s2): the page's four states (fresh, stale, none, paused), the refresh
// under its lease, a failed refresh keeping what it had, the recount and the send.

const NOW = Date.parse('2026-10-05T09:30:00Z');
const DOSSIER = { id: 'd-902', workspace_id: 'w1', home_repo: 'vertuoza/vertuo-omni-loop', prd: parsePrd(902) };

const summary = (more: Partial<GithubSummary> = {}): GithubSummary => ({
  repo: DOSSIER.home_repo, prd: DOSSIER.prd, folder: '0902-github-budget', topic: 'github-budget',
  issue: { number: parseIssue(902), url: 'https://github.com/vertuoza/vertuo-omni-loop/issues/902', state: 'open' },
  phase0: null, feature: null, retro: null, mergedSlices: 0, outbox: null, outboxComment: null, replies: null, retroText: null, care: null,
  ...more,
});

type Reads = { priority: Priority; ref: DossierRef }[];

/** Deps over a fake store and a reader answering `answers` in turn (the last one again after). */
function depsWith(answers: (GithubSummary | null)[], { store = fakeSnapshotStore(), paused = null as number | null } = {}) {
  const reads: Reads = [];
  const later: (() => Promise<void>)[] = [];
  const log = vi.fn();
  let i = 0;
  const deps: SnapshotDeps & { store: FakeSnapshotStore } = {
    store,
    reader: {
      summary: (ref, { priority }) => {
        reads.push({ ref, priority });
        const answer = answers[Math.min(i, answers.length - 1)] ?? null;
        i += 1;
        return Promise.resolve(answer);
      },
      forget: () => {},
    },
    pausedUntil: () => Promise.resolve(paused),
    now: () => NOW,
    later: (task) => { later.push(task); },
    log,
  };
  const runLater = async () => { for (const task of later.splice(0)) await task(); };
  return { deps, reads, later, runLater, log };
}

const keep = (store: FakeSnapshotStore, value: GithubSummary, more: { staleSince?: string | null; refreshingUntil?: string | null } = {}) => {
  store.rows.set(DOSSIER.id, { workspaceId: DOSSIER.workspace_id, summary: value, readAt: '2026-10-05T09:00:00Z', staleSince: null, refreshingUntil: null, ...more });
};

describe('the PRD page\'s snapshot', () => {
  it('fresh: renders the stored summary, says when it was read, and calls no GitHub', async () => {
    const { deps, reads, later } = depsWith([summary()]);
    keep(deps.store, summary({ mergedSlices: 3 }));
    const page = await pageSnapshot(DOSSIER, deps);
    expect(page.summary?.mergedSlices).toBe(3);
    expect(page.at).toEqual({ readAt: '2026-10-05T09:00:00Z', resumesAt: null });
    expect(reads).toEqual([]);
    expect(later).toEqual([]);
  });

  it('stale: renders at once, then refreshes once after the response, in the background', async () => {
    const { deps, reads, runLater } = depsWith([summary({ mergedSlices: 4 })]);
    keep(deps.store, summary({ mergedSlices: 3 }), { staleSince: '2026-10-05T09:10:00Z' });
    const page = await pageSnapshot(DOSSIER, deps);
    expect(page.summary?.mergedSlices).toBe(3);
    expect(reads).toEqual([]);
    await runLater();
    expect(reads.map((r) => r.priority)).toEqual(['background']);
    const row = deps.store.rows.get(DOSSIER.id);
    expect(row).toMatchObject({ readAt: new Date(NOW).toISOString(), staleSince: null, refreshingUntil: null });
    expect(row?.summary.mergedSlices).toBe(4);
  });

  it('none: a first visit makes one interactive read, renders it and stores it', async () => {
    const { deps, reads, runLater } = depsWith([summary({ mergedSlices: 2 })]);
    const page = await pageSnapshot(DOSSIER, deps);
    expect(page.summary?.mergedSlices).toBe(2);
    expect(page.at?.readAt).toBe(new Date(NOW).toISOString());
    expect(reads.map((r) => r.priority)).toEqual(['interactive']);
    await runLater();
    expect(deps.store.rows.get(DOSSIER.id)?.summary.mergedSlices).toBe(2);
  });

  it('none, and GitHub unread: nothing to render, nothing stored', async () => {
    const { deps, runLater } = depsWith([null]);
    expect(await pageSnapshot(DOSSIER, deps)).toEqual({ summary: null, at: null });
    await runLater();
    expect(deps.store.rows.size).toBe(0);
  });

  it('paused: keeps the snapshot and says when GitHub resumes', async () => {
    const until = NOW + 20 * 60_000;
    const { deps } = depsWith([summary()], { paused: until });
    keep(deps.store, summary());
    expect((await pageSnapshot(DOSSIER, deps)).at).toEqual({ readAt: '2026-10-05T09:00:00Z', resumesAt: new Date(until).toISOString() });
  });

  it('a pause already over says nothing, and a budget that cannot be read says nothing', async () => {
    const { deps } = depsWith([summary()], { paused: NOW - 1 });
    keep(deps.store, summary());
    expect((await pageSnapshot(DOSSIER, deps)).at?.resumesAt).toBeNull();
    const broken = depsWith([summary()]);
    keep(broken.deps.store, summary());
    broken.deps.pausedUntil = () => Promise.reject(new Error('down'));
    expect((await pageSnapshot(DOSSIER, broken.deps)).at?.resumesAt).toBeNull();
    expect(broken.log).toHaveBeenCalledTimes(1);
  });

  it('a snapshot that cannot be read is no snapshot: the page reads GitHub', async () => {
    const { deps, reads } = depsWith([summary()]);
    deps.store.read = () => Promise.reject(new Error('down'));
    expect((await pageSnapshot(DOSSIER, deps)).summary).not.toBeNull();
    expect(reads.map((r) => r.priority)).toEqual(['interactive']);
  });
});

describe('a refresh', () => {
  it('runs once at a time: a second refresh while the lease holds does nothing', async () => {
    const { deps, reads } = depsWith([summary()]);
    keep(deps.store, summary(), { staleSince: '2026-10-05T09:10:00Z', refreshingUntil: new Date(NOW + LEASE_MS / 2).toISOString() });
    expect(await refreshSnapshot(DOSSIER, 'background', deps)).toBe('busy');
    expect(reads).toEqual([]);
  });

  it('takes a lease that has run out', async () => {
    const { deps } = depsWith([summary()]);
    keep(deps.store, summary(), { staleSince: '2026-10-05T09:10:00Z', refreshingUntil: new Date(NOW - 1).toISOString() });
    expect(await refreshSnapshot(DOSSIER, 'background', deps)).toBe('refreshed');
  });

  it('that fails keeps the previous snapshot and leaves it stale, its lease freed', async () => {
    const { deps } = depsWith([null]);
    keep(deps.store, summary({ mergedSlices: 3 }), { staleSince: '2026-10-05T09:10:00Z' });
    expect(await refreshSnapshot(DOSSIER, 'background', deps)).toBe('failed');
    expect(deps.store.rows.get(DOSSIER.id)).toMatchObject({ readAt: '2026-10-05T09:00:00Z', staleSince: '2026-10-05T09:10:00Z', refreshingUntil: null });
    expect(deps.store.writes).toBe(0);
  });

  it('keeps each part it could not read from the snapshot, and leaves it stale', async () => {
    const { deps } = depsWith([summary({ mergedSlices: UNREAD, issue: null })]);
    keep(deps.store, summary({ mergedSlices: 3 }), { staleSince: '2026-10-05T09:10:00Z' });
    await refreshSnapshot(DOSSIER, 'background', deps);
    const row = deps.store.rows.get(DOSSIER.id);
    expect(row?.summary).toMatchObject({ mergedSlices: 3, issue: null });
    expect(row?.staleSince).toBe('2026-10-05T09:10:00Z');
  });

  it('leaves stale a snapshot marked stale while it read', async () => {
    const store = fakeSnapshotStore();
    const { deps } = depsWith([summary()], { store });
    keep(store, summary(), { staleSince: '2026-10-05T09:10:00Z' });
    const read = deps.reader.summary;
    deps.reader.summary = async (ref, options) => {
      const row = store.rows.get(DOSSIER.id);
      if (row) row.staleSince = new Date(NOW + 1000).toISOString();
      return read(ref, options);
    };
    await refreshSnapshot(DOSSIER, 'background', deps);
    expect(store.rows.get(DOSSIER.id)?.staleSince).toBe(new Date(NOW + 1000).toISOString());
  });

  it('whose lease cannot be taken is logged and reads nothing', async () => {
    const { deps, reads, log } = depsWith([summary()]);
    deps.store.lease = () => Promise.reject(new Error('down'));
    expect(await refreshSnapshot(DOSSIER, 'background', deps)).toBe('failed');
    expect(reads).toEqual([]);
    expect(log).toHaveBeenCalledTimes(1);
  });

  it('whose store refuses the write still answers what it read, and logs it', async () => {
    const { deps, log } = depsWith([summary({ mergedSlices: 5 })]);
    deps.store.write = () => Promise.reject(new Error('down'));
    expect((await sendSnapshot(DOSSIER, deps))?.mergedSlices).toBe(5);
    expect(log).toHaveBeenCalledTimes(1);
  });
});

describe('the recount and the send', () => {
  it('the recount derives from a current snapshot without reading GitHub', async () => {
    const { deps, reads } = depsWith([summary()]);
    keep(deps.store, summary({ mergedSlices: 3 }));
    expect((await recountSnapshot(DOSSIER, deps))?.mergedSlices).toBe(3);
    expect(reads).toEqual([]);
  });

  it('the recount refreshes a stale snapshot first, in the background', async () => {
    const { deps, reads } = depsWith([summary({ mergedSlices: 4 })]);
    keep(deps.store, summary({ mergedSlices: 3 }), { staleSince: '2026-10-05T09:10:00Z' });
    expect((await recountSnapshot(DOSSIER, deps))?.mergedSlices).toBe(4);
    expect(reads.map((r) => r.priority)).toEqual(['background']);
  });

  it('the recount keeps a stale snapshot whose refresh failed', async () => {
    const { deps } = depsWith([null]);
    keep(deps.store, summary({ mergedSlices: 3 }), { staleSince: '2026-10-05T09:10:00Z' });
    expect((await recountSnapshot(DOSSIER, deps))?.mergedSlices).toBe(3);
  });

  it('the recount reads and stores a missing snapshot, in the background', async () => {
    const { deps, reads } = depsWith([summary({ mergedSlices: 1 })]);
    expect((await recountSnapshot(DOSSIER, deps))?.mergedSlices).toBe(1);
    expect(reads.map((r) => r.priority)).toEqual(['background']);
    expect(deps.store.rows.get(DOSSIER.id)?.summary.mergedSlices).toBe(1);
  });

  it('the send forces one interactive read and stores it, and a posted reply marks the snapshot stale', async () => {
    const { deps, reads } = depsWith([summary({ mergedSlices: 6 })]);
    keep(deps.store, summary({ mergedSlices: 3 }));
    expect((await sendSnapshot(DOSSIER, deps))?.mergedSlices).toBe(6);
    expect(reads.map((r) => r.priority)).toEqual(['interactive']);
    expect(deps.store.rows.get(DOSSIER.id)?.summary.mergedSlices).toBe(6);
    await staleSnapshot(DOSSIER.id, deps);
    expect(deps.store.rows.get(DOSSIER.id)?.staleSince).toBe(new Date(NOW).toISOString());
  });
});

describe('a stored summary', () => {
  it('reads back exactly as it was written, and a summary made before a part leaves it out', () => {
    const full = summary({ outbox: { open: [], settled: [] }, care: UNREAD });
    expect(StoredSummary.parse(JSON.parse(JSON.stringify(full)))).toEqual(full);
    const { outbox: _o, replies: _r, retroText: _t, care: _c, outboxComment: _m, ...older } = full;
    expect(StoredSummary.parse(older)).toEqual(older);
  });

  it('refuses what is not a summary', () => {
    expect(StoredSummary.safeParse({ repo: 'x' }).success).toBe(false);
    expect(StoredSummary.safeParse({ ...summary(), issue: 'gone' }).success).toBe(false);
  });

  it('merges a fresh read with no stored one as it is', () => {
    expect(mergeSummary(null, summary())).toEqual({ summary: summary(), partial: false });
    expect(mergeSummary(null, summary({ issue: UNREAD })).partial).toBe(true);
  });
});
