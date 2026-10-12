// The stored fix facts in memory, for the tests of what reads and writes them (the refresh, the stages
// sync, /bugs, /visual and a fix's own page): the FixFactsStore of ./store.ts with the migration's rules
// written here as it writes them — one row per fix dossier, a write replacing its facts, a read keeping
// to the workspace asked. `fail` makes every call throw, as a refused Supabase call does. That the
// database holds the same rules is proved by supabase/checks/fix_facts.sql, not here. A concept's facts
// (PRD 1272, s4) keep the same rules in their own fake.
import type { ConceptFacts, FixSummary } from '../../dossier/github/fix';
import { settled } from '../../stages/settled';
import type { FactsRow, FactsStore } from './store';

export type FakeFactsStore<T> = FactsStore<T> & {
  rows: (FactsRow<T> & { synced_at: string })[];
  /** Every write of one or more dossiers, in order: `<workspace> <dossier id>, …`. */
  writes: string[];
  /** Every read, in order: `<workspace> <how many dossiers asked>`. */
  reads: string[];
  fail: string | null;
};
export type FakeFixFactsStore = FakeFactsStore<FixSummary>;
export type FakeConceptFactsStore = FakeFactsStore<ConceptFacts>;

function fakeFactsStore<T>(now: () => string): FakeFactsStore<T> {
  const fake: FakeFactsStore<T> = {
    rows: [],
    writes: [],
    reads: [],
    fail: null,

    readFacts(workspace, ids) {
      return settled(() => {
        check();
        fake.reads.push(`${workspace} ${ids.length}`);
        const wanted = new Set(ids);
        const facts = new Map<string, T>();
        for (const row of fake.rows) {
          if (row.workspace_id === workspace && wanted.has(row.dossier_id)) facts.set(row.dossier_id, row.facts);
        }
        return facts;
      });
    },

    writeFacts(rows, syncedAt = now()) {
      return settled(() => {
        check();
        if (rows.length === 0) return;
        for (const r of rows) {
          const row = { dossier_id: r.dossier_id, workspace_id: r.workspace_id, facts: r.facts, synced_at: syncedAt };
          fake.rows = [...fake.rows.filter((k) => k.dossier_id !== row.dossier_id), row];
        }
        fake.writes.push(rows.map((r) => `${r.workspace_id} ${r.dossier_id}`).join(', '));
      });
    },
  };
  function check() {
    if (fake.fail) throw new Error(`Supabase refused: ${fake.fail}`);
  }
  return fake;
}

export function fakeFixFactsStore(now: () => string = () => new Date().toISOString()): FakeFixFactsStore {
  return fakeFactsStore<FixSummary>(now);
}

export function fakeConceptFactsStore(now: () => string = () => new Date().toISOString()): FakeConceptFactsStore {
  return fakeFactsStore<ConceptFacts>(now);
}
