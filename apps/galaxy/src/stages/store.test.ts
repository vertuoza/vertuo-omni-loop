// The stored PRD stages (PRD 587): the store's rules on its fake, and its Supabase calls on a recording
// client. No test reaches Supabase.
import { describe, expect, it } from 'vitest';
import { fakeStageStore } from './store.fake';
import { countStages, currentOf, noCounts, stageStore, type StageRecord } from './store';

const W = 'w-acme';
const OTHER = 'w-other';
const REPO = 'acme/widgets';
const at = (day: number) => `2026-09-${String(day).padStart(2, '0')}T09:00:00Z`;
const rec = (prd: number, stage: StageRecord['stage'], day = 1, more: Partial<StageRecord> = {}): StageRecord =>
  ({ workspace_id: W, repository: REPO, prd, stage, reached_at: at(day), ...more });

describe('the store, on its fake', () => {
  it('records a stage once: a second write keeps the first date and refreshes when it was seen', async () => {
    const store = fakeStageStore();
    await store.recordStages([rec(7, 'prd', 1), rec(7, 'inbox', 2)], at(3));
    await store.recordStages([rec(7, 'inbox', 20)], at(21));
    expect(await store.stagesOf({ workspace_id: W, repository: REPO, prd: 7 })).toEqual([
      { stage: 'prd', reached_at: at(1), synced_at: at(3) },
      { stage: 'inbox', reached_at: at(2), synced_at: at(21) },
    ]);
    expect(store.writes).toHaveLength(2);
  });

  it('keeps the repository in lower case, and reads it in any case', async () => {
    const store = fakeStageStore();
    await store.recordStages([rec(7, 'prd', 1, { repository: 'Acme/Widgets' })], at(1));
    expect(await store.stagesOf({ workspace_id: W, repository: 'ACME/widgets', prd: 7 })).toHaveLength(1);
    expect(store.stages[0].repository).toBe('acme/widgets');
  });

  it('gives the current stage of each PRD, the latest on the track, and counts them, for a set of PRDs or all', async () => {
    const store = fakeStageStore();
    await store.recordStages([
      rec(1, 'prd'), rec(1, 'inbox'),
      rec(2, 'shipped', 1), rec(2, 'inbox', 9),
      rec(3, 'retro'),
      rec(4, 'building', 1, { repository: 'acme/core' }),
      rec(5, 'outbox', 1, { workspace_id: OTHER }),
    ], at(10));
    expect([...(await store.currentStages(W)).entries()].sort()).toEqual([
      ['acme/core#4', 'building'], ['acme/widgets#1', 'inbox'], ['acme/widgets#2', 'shipped'], ['acme/widgets#3', 'retro'],
    ]);
    expect(await store.stageCounts(W)).toEqual({ ...noCounts(), inbox: 1, building: 1, shipped: 1, retro: 1 });
    expect(await store.stageCounts(W, [{ repository: 'ACME/widgets', prd: 1 }, { repository: REPO, prd: 2 }, { repository: REPO, prd: 99 }]))
      .toEqual({ ...noCounts(), inbox: 1, shipped: 1 });
    expect(await store.stageCounts(W, [])).toEqual(noCounts());
  });

  it('learns each PRD\'s topic and finds a PRD by it, one topic per PRD and one PRD per topic', async () => {
    const store = fakeStageStore();
    await store.recordTopic({ workspace_id: W, repository: 'Acme/Widgets', prd: 7, topic: 'team-inbox' });
    await store.recordTopic({ workspace_id: W, repository: REPO, prd: 7, topic: 'team-inbox' });
    expect(store.writes).toEqual(['topic acme/widgets#7 team-inbox']);
    expect(await store.prdByTopic(W, 'acme/WIDGETS', 'team-inbox')).toBe(7);
    expect(await store.prdByTopic(W, REPO, 'nothing')).toBeNull();
    expect(await store.prdByTopic(OTHER, REPO, 'team-inbox')).toBeNull();
    await store.recordTopic({ workspace_id: W, repository: REPO, prd: 7, topic: 'shared-inbox' });
    expect(await store.prdByTopic(W, REPO, 'team-inbox')).toBeNull();
    await expect(store.recordTopic({ workspace_id: W, repository: REPO, prd: 8, topic: 'shared-inbox' })).rejects.toThrow(/23505/);
  });

  it('says when a repository was last synced: its latest PRD stage, never another stage', async () => {
    const store = fakeStageStore();
    expect(await store.lastSynced(W, REPO)).toBeNull();
    await store.recordStages([rec(7, 'prd')], at(3));
    await store.recordStages([rec(8, 'prd', 1, { repository: 'Acme/Widgets' })], at(5));
    await store.recordStages([rec(7, 'shipped'), rec(9, 'prd', 1, { workspace_id: OTHER })], at(9));
    expect(await store.lastSynced(W, 'ACME/widgets')).toBe(at(5));
  });

  it('throws when told to fail, as a refused call does', async () => {
    const store = fakeStageStore();
    store.fail = 'down';
    await expect(store.stagesOf({ workspace_id: W, repository: REPO, prd: 7 })).rejects.toThrow('Supabase refused: down');
  });
});

describe('counting', () => {
  it('counts current stages, and keeps each PRD to the latest stage on the track', () => {
    expect(countStages(['shipped', 'shipped', 'prd'])).toEqual({ ...noCounts(), shipped: 2, prd: 1 });
    expect(currentOf([{ repository: REPO, prd: 1, stage: 'retro' }, { repository: REPO, prd: 1, stage: 'prd' }]).get('acme/widgets#1')).toBe('retro');
  });
});

type Call = unknown[];

/** A client that records each call of the store's shapes and answers `rows` (a page at a time) or `refuse`. */
function recording(rows: unknown[] = [], refuse: { message: string; code?: string } | null = null) {
  const calls: Call[] = [];
  const answer = (data: unknown) => Promise.resolve(refuse ? { data: null, error: refuse } : { data, error: null });
  const query = (table: string, columns: string) => {
    const filters: Call = [];
    const chain = {
      eq: (column: string, value: unknown) => { filters.push([column, value]); return chain; },
      order: (column: string, options?: unknown) => { filters.push(options ? ['order', column, options] : ['order', column]); return chain; },
      limit: (count: number) => { filters.push(['limit', count]); return chain; },
      range: (first: number, last: number) => { calls.push(['select', table, columns, ...filters, ['range', first, last]]); return answer(rows.slice(first, last + 1)); },
      maybeSingle: () => { calls.push(['select', table, columns, ...filters, 'maybeSingle']); return answer(rows[0] ?? null); },
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
        calls.push(['select', table, columns, ...filters]);
        return answer(rows).then(resolve, reject);
      },
    };
    return chain;
  };
  const from = (table: string) => ({
    select: (columns: string) => query(table, columns),
    upsert: (values: unknown, options: unknown) => { calls.push(['upsert', table, values, options]); return answer(null); },
  });
  return { calls, db: { from } as never };
}

describe('the store, on Supabase', () => {
  it('upserts each stage with when it was seen, the repository in lower case, and writes nothing for none', async () => {
    const { calls, db } = recording();
    await stageStore(db).recordStages([], at(5));
    await stageStore(db).recordStages([rec(7, 'inbox', 2, { repository: 'Acme/Widgets' })], at(5));
    expect(calls).toEqual([[
      'upsert', 'prd_stages',
      [{ workspace_id: W, repository: 'acme/widgets', prd: 7, stage: 'inbox', reached_at: at(2), synced_at: at(5) }],
      { onConflict: 'workspace_id,repository,prd,stage' },
    ]]);
  });

  it('upserts a topic by its PRD', async () => {
    const { calls, db } = recording();
    await stageStore(db).recordTopic({ workspace_id: W, repository: 'Acme/Widgets', prd: 7, topic: 'team-inbox' });
    expect(calls).toEqual([['upsert', 'prd_topics', { workspace_id: W, repository: 'acme/widgets', prd: 7, topic: 'team-inbox' }, { onConflict: 'workspace_id,repository,prd' }]]);
  });

  it('reads a PRD\'s stages in track order, leaving out a stage it does not know', async () => {
    const { calls, db } = recording([
      { stage: 'shipped', reached_at: at(9), synced_at: at(10) }, { stage: 'prd', reached_at: at(1), synced_at: at(10) }, { stage: 'idea', reached_at: at(1), synced_at: at(1) },
    ]);
    expect((await stageStore(db).stagesOf({ workspace_id: W, repository: 'Acme/Widgets', prd: 7 })).map((r) => r.stage)).toEqual(['prd', 'shipped']);
    expect(calls).toEqual([['select', 'prd_stages', 'stage, reached_at, synced_at', ['workspace_id', W], ['repository', 'acme/widgets'], ['prd', 7]]]);
  });

  it('reads every stage of the workspace a page at a time for the current stages and their counts', async () => {
    const rows = Array.from({ length: 1001 }, (_, i) => ({ repository: REPO, prd: i + 1, stage: 'shipped' }));
    const { calls, db } = recording(rows);
    expect((await stageStore(db).stageCounts(W)).shipped).toBe(1001);
    expect(calls.map((c) => c.at(-1))).toEqual([['range', 0, 999], ['range', 1000, 1999]]);
    expect(await stageStore(recording(rows).db).currentStages(W, [])).toEqual(new Map());
  });

  it('reads when a repository was last synced from its PRD stages, the latest first; null for none', async () => {
    const { calls, db } = recording([{ synced_at: at(12) }]);
    expect(await stageStore(db).lastSynced(W, 'Acme/Widgets')).toBe(at(12));
    expect(calls).toEqual([[
      'select', 'prd_stages', 'synced_at', ['workspace_id', W], ['repository', 'acme/widgets'], ['stage', 'prd'],
      ['order', 'synced_at', { ascending: false }], ['limit', 1], 'maybeSingle',
    ]]);
    expect(await stageStore(recording([]).db).lastSynced(W, REPO)).toBeNull();
  });

  it('finds a PRD by its topic', async () => {
    const { calls, db } = recording([{ prd: 7 }]);
    expect(await stageStore(db).prdByTopic(W, 'Acme/Widgets', 'team-inbox')).toBe(7);
    expect(calls).toEqual([['select', 'prd_topics', 'prd', ['workspace_id', W], ['repository', 'acme/widgets'], ['topic', 'team-inbox'], 'maybeSingle']]);
    expect(await stageStore(recording([]).db).prdByTopic(W, REPO, 'none')).toBeNull();
  });

  it('says what Supabase refused, and why', async () => {
    const { db } = recording([], { message: 'permission denied for table prd_stages', code: '42501' });
    await expect(stageStore(db).recordStages([rec(7, 'prd')])).rejects.toThrow('Supabase refused to record 1 stage: permission denied for table prd_stages (42501)');
    await expect(stageStore(db).stagesOf({ workspace_id: W, repository: REPO, prd: 7 })).rejects.toThrow('Supabase refused to read the stages of PRD 7');
  });
});
