// The stored PRD outboxes in memory, for the tests of what reads and writes them (the sync, the stage
// events, the sends, /prd and the waiting outbox): the PrdOutboxStore of ./store.ts with the
// migration's rules written here as it writes them — one row per PRD, the repository in lower case, a
// write replacing the counts. `fail` makes every call throw, as a refused Supabase call does. That the
// database holds the same rules is proved by supabase/checks/prd_outbox.sql, not here.
import { prdKey } from '../store';
import type { OutboxCounts, OutboxRecord, PrdOutboxStore } from './store';

export type FakePrdOutboxStore = PrdOutboxStore & {
  rows: (OutboxRecord & { synced_at: string })[];
  /** Every write, in order: `<workspace> <owner/name#n> <open>`. */
  writes: string[];
  /** Every read, in order: `<workspace> <how many PRDs asked>`. */
  reads: string[];
  fail: string | null;
};

export function fakePrdOutboxStore(now: () => string = () => new Date().toISOString()): FakePrdOutboxStore {
  const fake: FakePrdOutboxStore = {
    rows: [],
    writes: [],
    reads: [],
    fail: null,

    async record(rows, syncedAt = now()) {
      check();
      for (const r of rows) {
        const row = { ...r, repository: r.repository.toLowerCase(), synced_at: syncedAt };
        fake.rows = [...fake.rows.filter((k) => !(k.workspace_id === row.workspace_id && prdKey(k) === prdKey(row))), row];
        fake.writes.push(`${row.workspace_id} ${prdKey(row)} ${row.open_questions}`);
      }
    },

    async countsOf(workspace, prds) {
      check();
      fake.reads.push(`${workspace} ${prds.length}`);
      const wanted = new Set(prds.map(prdKey));
      const counts = new Map<string, OutboxCounts>();
      for (const row of fake.rows) {
        if (row.workspace_id === workspace && wanted.has(prdKey(row))) {
          counts.set(prdKey(row), { open_questions: row.open_questions, waiting: row.waiting });
        }
      }
      return counts;
    },
  };
  function check() {
    if (fake.fail) throw new Error(`Supabase refused: ${fake.fail}`);
  }
  return fake;
}
