// The stored PRD stages in memory, for the tests of what reads and writes them (the page, the sync, the
// stage events, the lists): the StageStore of ./store.ts with the migration's rules written here as it
// writes them — a stage recorded once, a second write keeping its first date and refreshing synced_at,
// the repository in lower case, one topic per PRD and one PRD per topic in a repository. `fail` makes
// every call throw, as a refused Supabase call does. That the database holds the same rules is proved
// by supabase/checks/prd_stages.sql, not here.
import { countStages, currentOf, prdKey, type StageKey, type StageRecord, type StageStore, type TopicRecord } from './store';
import { STORED_STAGES, type StageRow } from './stage';

type Stored = StageKey & StageRow;

export type FakeStageStore = StageStore & {
  stages: Stored[];
  topics: TopicRecord[];
  /** Every write, in order: what a test counts to prove a rerun wrote nothing new. */
  writes: string[];
  fail: string | null;
};

const same = (a: StageKey, b: StageKey) => a.workspace_id === b.workspace_id && a.repository === b.repository && a.prd === b.prd;

export function fakeStageStore(now: () => string = () => new Date().toISOString()): FakeStageStore {
  const fake: FakeStageStore = {
    stages: [],
    topics: [],
    writes: [],
    fail: null,

    async recordStages(rows: readonly StageRecord[], syncedAt = now()) {
      check();
      for (const r of rows) {
        const row = { ...r, repository: r.repository.toLowerCase() };
        const kept = fake.stages.find((s) => same(s, row) && s.stage === row.stage);
        if (kept) {
          kept.synced_at = syncedAt;
          continue;
        }
        fake.stages.push({ ...row, synced_at: syncedAt });
        fake.writes.push(`stage ${prdKey(row)} ${row.stage} ${row.reached_at}`);
      }
    },

    async recordTopic(record: TopicRecord) {
      check();
      const topic = { ...record, repository: record.repository.toLowerCase() };
      const taken = fake.topics.find((t) => t.workspace_id === topic.workspace_id && t.repository === topic.repository && t.topic === topic.topic);
      if (taken && taken.prd !== topic.prd) {
        throw new Error(`Supabase refused to record the topic of PRD ${topic.prd}: duplicate key value violates unique constraint (23505)`);
      }
      const kept = fake.topics.find((t) => same(t, topic));
      if (kept?.topic === topic.topic) return;
      fake.topics = [...fake.topics.filter((t) => !same(t, topic)), topic];
      fake.writes.push(`topic ${prdKey(topic)} ${topic.topic}`);
    },

    async stagesOf(key: StageKey) {
      check();
      const at = { ...key, repository: key.repository.toLowerCase() };
      return fake.stages
        .filter((s) => same(s, at))
        .map(({ stage, reached_at, synced_at }) => ({ stage, reached_at, synced_at }))
        .sort((a, b) => STORED_STAGES.indexOf(a.stage) - STORED_STAGES.indexOf(b.stage));
    },

    async currentStages(workspace, prds) {
      check();
      return currentOf(fake.stages.filter((s) => s.workspace_id === workspace), prds);
    },

    async stageCounts(workspace, prds) {
      return countStages((await fake.currentStages(workspace, prds)).values());
    },

    async prdByTopic(workspace, repository, topic) {
      check();
      return fake.topics.find((t) => t.workspace_id === workspace && t.repository === repository.toLowerCase() && t.topic === topic)?.prd ?? null;
    },
  };
  function check() {
    if (fake.fail) throw new Error(`Supabase refused: ${fake.fail}`);
  }
  return fake;
}
