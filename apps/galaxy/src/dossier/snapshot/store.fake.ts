// An in-memory SnapshotStore for tests: dossier_github's rules (one row per dossier, a lease taken only
// when free, a stale mark kept when already set) as ./store.ts asks the database for them. That the
// database holds the same rules is proved by supabase/checks/dossier_github.sql, not here.
import type { PrdNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import type { Snapshot, SnapshotStore } from './store';

export type FakeSnapshotStore = SnapshotStore & {
  rows: Map<string, Snapshot & { workspaceId: string }>;
  /** The numbered PRD dossiers dossierOf() finds, as `<workspace> <repository>#<prd>` → id. */
  dossiers: Map<string, string>;
  writes: number;
};

const dossierKey = (workspaceId: string, repository: string, prd: PrdNumber) => `${workspaceId} ${repository.toLowerCase()}#${prd}`;

export function fakeSnapshotStore(): FakeSnapshotStore {
  const rows = new Map<string, Snapshot & { workspaceId: string }>();
  const dossiers = new Map<string, string>();
  const store: FakeSnapshotStore = {
    rows,
    dossiers,
    writes: 0,
    read: (id) => {
      const row = rows.get(id);
      return Promise.resolve(row ? { summary: row.summary, readAt: row.readAt, staleSince: row.staleSince, refreshingUntil: row.refreshingUntil } : null);
    },
    write: ({ dossierId, workspaceId, summary, readAt }) => {
      store.writes += 1;
      const was = rows.get(dossierId);
      rows.set(dossierId, { workspaceId, summary, readAt, staleSince: was?.staleSince ?? null, refreshingUntil: null });
      return Promise.resolve();
    },
    markStale: (id, at) => {
      const row = rows.get(id);
      if (row && row.staleSince === null) row.staleSince = at;
      return Promise.resolve();
    },
    current: (id, before) => {
      const row = rows.get(id);
      if (row && row.staleSince !== null && row.staleSince <= before) row.staleSince = null;
      return Promise.resolve();
    },
    lease: (id, now, until) => {
      const row = rows.get(id);
      if (!row || (row.refreshingUntil !== null && row.refreshingUntil >= now)) return Promise.resolve(false);
      row.refreshingUntil = until;
      return Promise.resolve(true);
    },
    release: (id) => {
      const row = rows.get(id);
      if (row) row.refreshingUntil = null;
      return Promise.resolve();
    },
    dossierOf: (workspaceId, repository, prd) => Promise.resolve(dossiers.get(dossierKey(workspaceId, repository, prd)) ?? null),
  };
  return store;
}
