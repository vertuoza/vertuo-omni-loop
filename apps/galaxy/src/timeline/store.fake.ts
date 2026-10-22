// A PRD's stored milestones in memory, for the tests of what reads and writes them (the stages sync, the
// PRD page, the Engineering board): the MilestoneStore of ./store.ts with the migration's rules written
// here as it writes them — a milestone recorded once per PRD and lane, a second write keeping its first
// time and pull request but a later last-slice, refreshing synced_at, the repository and the lane in
// lower case. `fail` makes every call throw, as a refused Supabase call does. That the database holds the
// same rules is proved by supabase/checks/prd_milestones.sql, not here.
import { settled } from '../stages/settled';
import { byLaneThenTimeline, kept, type MilestoneKey, type MilestoneRecord, type MilestoneStore } from './store';

type Stored = MilestoneRecord & { synced_at: string };

export type FakeMilestoneStore = MilestoneStore & {
  milestones: Stored[];
  /** Every write that set a time, in order: what a test counts to prove a rerun moved nothing. */
  writes: string[];
  fail: string | null;
};

const same = (a: MilestoneKey, b: MilestoneKey) => a.workspace_id === b.workspace_id && a.repository === b.repository && a.prd === b.prd;

export function fakeMilestoneStore(now: () => string = () => new Date().toISOString()): FakeMilestoneStore {
  const fake: FakeMilestoneStore = {
    milestones: [],
    writes: [],
    fail: null,

    recordMilestones(rows, syncedAt = now()) {
      return settled(() => {
        check();
        for (const r of rows) {
          const row = { ...r, repository: r.repository.toLowerCase(), lane: r.lane.toLowerCase() };
          const stored = fake.milestones.find((m) => same(m, row) && m.lane === row.lane && m.milestone === row.milestone);
          if (!stored) {
            fake.milestones.push({ ...row, synced_at: syncedAt });
            fake.writes.push(`milestone ${row.repository}#${row.prd} ${row.lane} ${row.milestone} ${row.reached_at}`);
            continue;
          }
          stored.synced_at = syncedAt;
          const keep = kept(stored, row);
          if (keep === stored) continue;
          stored.pr = keep.pr;
          stored.reached_at = keep.reached_at;
          fake.writes.push(`milestone ${row.repository}#${row.prd} ${row.lane} ${row.milestone} ${row.reached_at}`);
        }
      });
    },

    milestonesOf(key) {
      return settled(() => {
        check();
        const at = { ...key, repository: key.repository.toLowerCase() };
        return fake.milestones
          .filter((m) => same(m, at))
          .map(({ lane, milestone, pr, reached_at }) => ({ lane, milestone, pr, reached_at }))
          .sort(byLaneThenTimeline);
      });
    },

    workspaceMilestones(workspace) {
      return settled(() => {
        check();
        return fake.milestones
          .filter((m) => m.workspace_id === workspace)
          .map(({ repository, prd, lane, milestone, pr, reached_at }) => ({ repository, prd, lane, milestone, pr, reached_at }));
      });
    },

    lastSynced(workspace, repository) {
      return settled(() => {
        check();
        let latest: string | null = null;
        for (const m of fake.milestones) {
          const ours = m.workspace_id === workspace && m.repository === repository.toLowerCase();
          if (ours && (latest === null || Date.parse(m.synced_at) > Date.parse(latest))) latest = m.synced_at;
        }
        return latest;
      });
    },
  };
  function check() {
    if (fake.fail) throw new Error(`Supabase refused: ${fake.fail}`);
  }
  return fake;
}
