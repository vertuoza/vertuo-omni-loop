// A PRD's stored milestones (PRD 2370, s1): the store's rules on its fake, and its Supabase calls on a
// recording client. No test reaches Supabase: that the database holds the same rules is proved by
// supabase/checks/prd_milestones.sql.
import { describe, expect, it } from 'vitest';
import { brokenRows } from '../data/broken-rows.fake';
import { fakeMilestoneStore } from './store.fake';
import { kept, type MilestoneRecord } from './store';
import { milestoneStore, StoredMilestone, StoredWorkspaceMilestone } from './store.repository';
import { parsePr, parsePrd } from 'omni-loop/kit/lib/ids.ts';

const W = 'w-acme';
const OTHER = 'w-other';
const REPO = 'acme/widgets';
const at = (day: number) => `2026-09-${String(day).padStart(2, '0')}T09:00:00Z`;
const rec = (prd: number, milestone: MilestoneRecord['milestone'], day = 1, more: Partial<MilestoneRecord> = {}): MilestoneRecord => ({
  workspace_id: W, repository: REPO, prd: parsePrd(prd), lane: REPO, milestone,
  pr: ['idea', 'plan', 'approved'].includes(milestone) ? null : parsePr(100 + day), reached_at: at(day), ...more,
});
const key = (prd: number, repository = REPO) => ({ workspace_id: W, repository, prd: parsePrd(prd) });

describe('the rule a second write follows', () => {
  it('keeps the stored milestone, but a later last-slice and its pull request', () => {
    const stored = { lane: REPO, milestone: 'last-slice' as const, pr: parsePr(5), reached_at: at(5) };
    expect(kept(stored, { ...stored, pr: parsePr(9), reached_at: at(9) })).toEqual({ ...stored, pr: 9, reached_at: at(9) });
    expect(kept(stored, { ...stored, pr: parsePr(3), reached_at: at(3) })).toBe(stored);
    const opened = { ...stored, milestone: 'opened' as const };
    expect(kept(opened, { ...opened, pr: parsePr(9), reached_at: at(9) })).toBe(opened);
    expect(kept(opened, { ...opened, pr: parsePr(3), reached_at: at(3) })).toBe(opened);
  });
});

describe('the store, on its fake', () => {
  it('keeps the first time of a milestone, refreshes when it was seen, and moves last-slice only later', async () => {
    const store = fakeMilestoneStore();
    await store.recordMilestones([rec(7, 'approved', 1), rec(7, 'opened', 2), rec(7, 'last-slice', 5)], at(6));
    await store.recordMilestones([rec(7, 'approved', 9), rec(7, 'opened', 9), rec(7, 'last-slice', 4)], at(10));
    expect(store.writes).toHaveLength(3);
    await store.recordMilestones([rec(7, 'last-slice', 8)], at(11));
    expect(await store.milestonesOf(key(7))).toEqual([
      { lane: REPO, milestone: 'approved', pr: null, reached_at: at(1) },
      { lane: REPO, milestone: 'opened', pr: 102, reached_at: at(2) },
      { lane: REPO, milestone: 'last-slice', pr: 108, reached_at: at(8) },
    ]);
    expect(store.writes).toEqual([
      `milestone acme/widgets#7 ${REPO} approved ${at(1)}`,
      `milestone acme/widgets#7 ${REPO} opened ${at(2)}`,
      `milestone acme/widgets#7 ${REPO} last-slice ${at(5)}`,
      `milestone acme/widgets#7 ${REPO} last-slice ${at(8)}`,
    ]);
  });

  it('keeps a milestone per lane, the repositories in lower case, and reads them lane by lane in timeline order', async () => {
    const store = fakeMilestoneStore();
    await store.recordMilestones([
      rec(7, 'merged', 9, { lane: 'Acme/Gears' }),
      rec(7, 'opened', 3, { lane: 'acme/gears' }),
      rec(7, 'opened', 2),
      rec(7, 'approved', 1, { repository: 'Acme/Widgets' }),
      rec(8, 'opened', 4),
      rec(7, 'opened', 4, { workspace_id: OTHER }),
    ], at(10));
    expect((await store.milestonesOf(key(7, 'ACME/widgets'))).map((m) => `${m.lane} ${m.milestone}`)).toEqual([
      'acme/gears opened', 'acme/gears merged', 'acme/widgets approved', 'acme/widgets opened',
    ]);
    expect((await store.workspaceMilestones(W)).map((m) => `${m.repository}#${m.prd} ${m.lane} ${m.milestone}`).sort()).toEqual([
      'acme/widgets#7 acme/gears merged', 'acme/widgets#7 acme/gears opened', 'acme/widgets#7 acme/widgets approved',
      'acme/widgets#7 acme/widgets opened', 'acme/widgets#8 acme/widgets opened',
    ]);
  });

  it('says when a repository\'s milestones were last synced; null for none', async () => {
    const store = fakeMilestoneStore();
    expect(await store.lastSynced(W, REPO)).toBeNull();
    await store.recordMilestones([rec(7, 'opened')], at(3));
    await store.recordMilestones([rec(8, 'opened', 1, { repository: 'Acme/Widgets' })], at(5));
    await store.recordMilestones([rec(9, 'opened', 1, { workspace_id: OTHER })], at(9));
    expect(await store.lastSynced(W, 'ACME/widgets')).toBe(at(5));
  });

  it('throws when told to fail, as a refused call does', async () => {
    const store = fakeMilestoneStore();
    store.fail = 'down';
    await expect(store.milestonesOf(key(7))).rejects.toThrow('Supabase refused: down');
    await expect(store.recordMilestones([rec(7, 'opened')])).rejects.toThrow('Supabase refused: down');
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
  it('upserts each milestone with when it was seen, the repositories in lower case, and writes nothing for none', async () => {
    const { calls, db } = recording();
    await milestoneStore(db).recordMilestones([], at(5));
    await milestoneStore(db).recordMilestones([rec(7, 'opened', 2, { repository: 'Acme/Widgets', lane: 'Acme/Gears' })], at(5));
    expect(calls).toEqual([[
      'upsert', 'prd_milestones',
      [{ workspace_id: W, repository: 'acme/widgets', prd: 7, lane: 'acme/gears', milestone: 'opened', pr: 102, reached_at: at(2), synced_at: at(5) }],
      { onConflict: 'workspace_id,repository,prd,lane,milestone' },
    ]]);
  });

  it('upserts a large batch a thousand rows at a time', async () => {
    const { calls, db } = recording();
    const rows = Array.from({ length: 1001 }, (_, i) => rec(i + 1, 'opened'));
    await milestoneStore(db).recordMilestones(rows, at(5));
    expect(calls.map((c) => (c[2] as unknown[]).length)).toEqual([1000, 1]);
  });

  it('reads a PRD\'s milestones lane by lane in timeline order, leaving out a milestone it does not know', async () => {
    const { calls, db } = recording([
      { lane: REPO, milestone: 'merged', pr: 9, reached_at: at(9) },
      { lane: REPO, milestone: 'approved', pr: null, reached_at: at(1) },
      { lane: REPO, milestone: 'deployed', pr: 9, reached_at: at(10) },
    ]);
    expect((await milestoneStore(db).milestonesOf(key(7, 'Acme/Widgets'))).map((m) => m.milestone)).toEqual(['approved', 'merged']);
    expect(calls).toEqual([['select', 'prd_milestones', 'lane, milestone, pr, reached_at', ['workspace_id', W], ['repository', 'acme/widgets'], ['prd', 7]]]);
  });

  it('reads every milestone of the workspace a page at a time', async () => {
    const rows = Array.from({ length: 1001 }, (_, i) => ({ repository: REPO, prd: i + 1, lane: REPO, milestone: 'opened', pr: 3, reached_at: at(1) }));
    const { calls, db } = recording(rows);
    expect(await milestoneStore(db).workspaceMilestones(W)).toHaveLength(1001);
    expect(calls.map((c) => c.at(-1))).toEqual([['range', 0, 999], ['range', 1000, 1999]]);
    expect(calls[0]?.slice(0, 4)).toEqual(['select', 'prd_milestones', 'repository, prd, lane, milestone, pr, reached_at', ['workspace_id', W]]);
  });

  it('reads when a repository\'s milestones were last synced, the latest first; null for none', async () => {
    const { calls, db } = recording([{ synced_at: at(12) }]);
    expect(await milestoneStore(db).lastSynced(W, 'Acme/Widgets')).toBe(at(12));
    expect(calls).toEqual([[
      'select', 'prd_milestones', 'synced_at', ['workspace_id', W], ['repository', 'acme/widgets'],
      ['order', 'synced_at', { ascending: false }], ['limit', 1], 'maybeSingle',
    ]]);
    expect(await milestoneStore(recording([]).db).lastSynced(W, REPO)).toBeNull();
  });

  it('says what Supabase refused, and why', async () => {
    const { db } = recording([], { message: 'permission denied for table prd_milestones', code: '42501' });
    await expect(milestoneStore(db).recordMilestones([rec(7, 'opened')])).rejects.toThrow('Supabase refused to record 1 milestone: permission denied for table prd_milestones (42501)');
    await expect(milestoneStore(db).milestonesOf(key(7))).rejects.toThrow('Supabase refused to read the milestones of PRD 7');
    await expect(milestoneStore(db).workspaceMilestones(W)).rejects.toThrow('Supabase refused to read the milestones');
    await expect(milestoneStore(db).lastSynced(W, REPO)).rejects.toThrow('Supabase refused to read when the milestones of acme/widgets were last synced');
  });
});

describe('the milestone rows\' schemas', () => {
  const row = { lane: REPO, milestone: 'opened', pr: 12, reached_at: at(2) };

  it('parses a milestone as milestonesOf() reads it, and refuses a column missing, of the wrong type or null', () => {
    expect(StoredMilestone.parse(row)).toEqual(row);
    expect(StoredMilestone.parse({ ...row, milestone: 'approved', pr: null })).toEqual({ ...row, milestone: 'approved', pr: null });
    for (const [how, broken] of brokenRows(row, { missing: 'reached_at', wrongType: ['pr', 'twelve'], notNull: 'lane' })) {
      expect(StoredMilestone.safeParse(broken).success, how).toBe(false);
    }
  });

  it('parses a workspace\'s milestone with its PRD', () => {
    const wide = { ...row, repository: REPO, prd: 7 };
    expect(StoredWorkspaceMilestone.parse(wide)).toEqual(wide);
    expect(StoredWorkspaceMilestone.safeParse({ ...wide, prd: 0 }).success).toBe(false);
  });
});
