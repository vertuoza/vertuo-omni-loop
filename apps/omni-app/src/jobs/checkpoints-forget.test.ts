// The `checkpoints-forget` job (PRD 2809 s6) with a fake store and a fixed clock: no test calls Supabase.
import { describe, expect, it } from 'vitest';
import type { CheckpointStore, Kept } from '../checkpoints/store.ts';
import { CHECKPOINTS_FORGET_KIND, checkpointsForgetHandler, KEEP_MS, tooOld } from './checkpoints-forget.ts';
import type { ClaimedJob } from './ledger.ts';

const NOW = Date.parse('2027-01-20T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const iso = (ms: number) => new Date(ms).toISOString();

const save = (n: number, madeAgo: number, jobId = `job-${String(n)}`): Kept => ({
  id: `c-${String(n)}`,
  jobId,
  path: `w-1/${jobId}/${String(n)}.bundle`,
  createdAt: iso(NOW - madeAgo),
  keepUntil: iso(NOW - madeAgo + KEEP_MS),
});

/** A store in memory: the saves in the bucket, the jobs whose chain ended, what was removed and stamped. */
function fakeStore(rows: Kept[], endedJobs: string[] = []) {
  const live = new Map(rows.map((row) => [row.id, row]));
  const removed: string[] = [];
  const stamped: { ids: string[]; at: string }[] = [];
  const store: CheckpointStore = {
    kept: (offset, limit) => Promise.resolve([...live.values()].slice(offset, offset + limit)),
    ended: (jobIds) => Promise.resolve(new Set(jobIds.filter((id) => endedJobs.includes(id)))),
    remove: (paths) => {
      removed.push(...paths);
      return Promise.resolve();
    },
    stamp: (ids, at) => {
      stamped.push({ ids: [...ids], at: at.toISOString() });
      for (const id of ids) live.delete(id);
      return Promise.resolve();
    },
  };
  return { store, removed, stamped, live };
}

const JOB = { id: 'j-1', kind: CHECKPOINTS_FORGET_KIND, payload: { slot: '2027-01-20T12:00:00.000Z' } } as unknown as ClaimedJob;
const quiet = () => undefined;
const run = (store: CheckpointStore) => checkpointsForgetHandler({ store, clock: () => NOW, log: quiet })(JOB);

describe('the checkpoints-forget job', () => {
  it('deletes the bundles of a chain that ended, and stamps them at the clock', async () => {
    const db = fakeStore([save(1, DAY, 'job-a'), save(2, DAY, 'job-b')], ['job-a']);
    expect(await run(db.store)).toEqual({ outcome: 'done' });
    expect(db.removed).toEqual(['w-1/job-a/1.bundle']);
    expect(db.stamped).toEqual([{ ids: ['c-1'], at: iso(NOW) }]);
    expect([...db.live.keys()]).toEqual(['c-2']);
  });

  it('deletes any bundle 7 days old, though its chain goes on', async () => {
    const db = fakeStore([save(1, 7 * DAY), save(2, 7 * DAY - 1000), save(3, 8 * DAY)]);
    await run(db.store);
    expect(db.removed).toEqual(['w-1/job-1/1.bundle', 'w-1/job-3/3.bundle']);
    expect([...db.live.keys()]).toEqual(['c-2']);
  });

  it('deletes a bundle whose keep_until has passed', async () => {
    const early = { ...save(1, DAY), keepUntil: iso(NOW - 1) };
    const db = fakeStore([early]);
    await run(db.store);
    expect(db.removed).toEqual([early.path]);
  });

  it('keeps a young bundle of a chain still going', async () => {
    const db = fakeStore([save(1, DAY)]);
    await run(db.store);
    expect(db.removed).toEqual([]);
    expect(db.stamped).toEqual([]);
    expect(db.live.size).toBe(1);
  });

  it('forgets nothing twice: a second run finds nothing left', async () => {
    const db = fakeStore([save(1, 8 * DAY)]);
    await run(db.store);
    await run(db.store);
    expect(db.removed).toEqual(['w-1/job-1/1.bundle']);
  });

  it('reads on past the saves it keeps, page after page', async () => {
    const young = Array.from({ length: 200 }, (_, i) => save(i, DAY));
    const old = save(999, 9 * DAY);
    const db = fakeStore([...young, old]);
    await run(db.store);
    expect(db.removed).toEqual([old.path]);
  });

  it('lets a refusal of the bucket fail the run, and stamps nothing: the next try takes the row again', async () => {
    const db = fakeStore([save(1, 8 * DAY)]);
    const store: CheckpointStore = { ...db.store, remove: () => Promise.reject(new Error('the bucket refused: nope')) };
    await expect(run(store)).rejects.toThrow('the bucket refused');
    expect(db.stamped).toEqual([]);
  });
});

describe('tooOld', () => {
  it('is 7 days from the save', () => {
    expect(KEEP_MS).toBe(7 * DAY);
    expect(tooOld(save(1, 7 * DAY), NOW)).toBe(true);
    expect(tooOld(save(1, 7 * DAY - 1), NOW)).toBe(false);
  });
});
