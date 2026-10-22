// The stored waits in memory (PRD 2377, s1), for the tests of what writes them: the WaitStore of
// ./waits.ts with the migration's rules written here as it holds them — a row's since never moves, an
// ended row stays ended and is never deleted, the repository in lower case, one open row per wait. `fail`
// makes every call throw, as a refused Supabase call does. That the database holds the same rules is
// proved by supabase/checks/waits.sql, not here.
import { settled } from '../settled';
import type { SeenWait, StoredWait, WaitChanges, WaitStore } from './waits';
import type { PrdNumber } from 'omni-loop/kit/lib/ids.ts';

/** A row of public.waits. */
export type FakeWaitRow = SeenWait & { id: string; workspace_id: string; repo: string; seen_at: string; ended_at: string | null };

export type FakeWaitStore = WaitStore & {
  rows: FakeWaitRow[];
  /** The PRDs of each owners read, in order. */
  ownerReads: PrdNumber[][];
  fail: string | null;
};

const same = (a: Pick<SeenWait, 'prd' | 'pr' | 'kind'>, b: Pick<SeenWait, 'prd' | 'pr' | 'kind'>) => a.prd === b.prd && a.pr === b.pr && a.kind === b.kind;

/** A fake store; `owners` maps a PRD's number to its owner's GitHub login. */
export function fakeWaitStore(owners: Record<number, string> = {}): FakeWaitStore {
  let next = 0;
  const check = () => {
    if (fake.fail !== null) throw new Error(fake.fail);
  };
  const fake: FakeWaitStore = {
    rows: [],
    ownerReads: [],
    fail: null,

    openWaits(workspaceId, repository) {
      return settled(() => {
        check();
        return fake.rows
          .filter((r) => r.workspace_id === workspaceId && r.repo === repository.toLowerCase() && r.ended_at === null)
          .map(({ id, prd, pr, kind, turn, since, seen_at }): StoredWait => ({ id, prd, pr, kind, turn: [...turn], since, seen_at }));
      });
    },

    applyWaits(workspaceId, repository, { opened, refreshed, ended }: WaitChanges, at) {
      return settled(() => {
        check();
        const repo = repository.toLowerCase();
        for (const row of fake.rows) if (ended.includes(row.id) && row.ended_at === null) row.ended_at = at;
        for (const wait of refreshed) {
          const row = fake.rows.find((r) => r.id === wait.id);
          if (row) Object.assign(row, { turn: [...wait.turn], seen_at: wait.seen_at });
        }
        for (const wait of opened) {
          if (fake.rows.some((r) => r.workspace_id === workspaceId && r.repo === repo && r.ended_at === null && same(r, wait))) {
            throw new Error('duplicate key value violates unique constraint "waits_one_open"');
          }
          next += 1;
          fake.rows.push({ ...wait, turn: [...wait.turn], id: `wait-${String(next)}`, workspace_id: workspaceId, repo, ended_at: null });
        }
      });
    },

    owners(_workspaceId, _repository, prds) {
      return settled(() => {
        check();
        fake.ownerReads.push([...prds]);
        return new Map(prds.flatMap((prd) => (owners[prd] === undefined ? [] : [[prd, owners[prd]] as const])));
      });
    },
  };
  return fake;
}
