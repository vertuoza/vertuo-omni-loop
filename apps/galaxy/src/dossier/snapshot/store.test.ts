// The GitHub snapshot store (PRD 902, s2): its Supabase calls on a recording client, and its fake's
// rules. No test reaches Supabase.
import { describe, expect, it, vi } from 'vitest';
import { parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';
import type { GithubSummary } from '../github/summary';
import { snapshotStore } from './store';
import { fakeSnapshotStore } from './store.fake';

const SUMMARY: GithubSummary = {
  repo: 'acme/widgets', prd: parsePrd(7), folder: null, topic: null, issue: null, phase0: null, feature: null, retro: null, mergedSlices: 0,
};

/** A client that records each chain of calls on a table, and answers each chain with `answer`. */
function recording(answer: { data: unknown; error: { message: string; code?: string } | null } = { data: null, error: null }) {
  const calls: unknown[][] = [];
  const from = (table: string) => {
    const call: unknown[] = [table];
    calls.push(call);
    const chain: Record<string, unknown> = {};
    for (const name of ['select', 'update', 'upsert', 'eq', 'is', 'lte', 'or', 'ilike', 'limit', 'maybeSingle']) {
      chain[name] = (...args: unknown[]) => { call.push([name, ...args]); return chain; };
    }
    chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(answer).then(resolve);
    return chain;
  };
  return { calls, db: { from } as never };
}

describe('the store, on Supabase', () => {
  it('reads a dossier\'s snapshot, parsed', async () => {
    const row = { summary: SUMMARY, read_at: '2026-10-05T09:00:00Z', stale_since: null, refreshing_until: null };
    const { calls, db } = recording({ data: row, error: null });
    expect(await snapshotStore(db).read('d1')).toEqual({ summary: SUMMARY, readAt: '2026-10-05T09:00:00Z', staleSince: null, refreshingUntil: null });
    expect(calls).toEqual([['dossier_github', ['select', 'summary, read_at, stale_since, refreshing_until'], ['eq', 'dossier_id', 'd1'], ['maybeSingle']]]);
  });

  it('reads none, and reads a row that is not a snapshot as none', async () => {
    expect(await snapshotStore(recording().db).read('d1')).toBeNull();
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await snapshotStore(recording({ data: { summary: { repo: 1 }, read_at: 'x', stale_since: null, refreshing_until: null }, error: null }).db).read('d1')).toBeNull();
    expect(log).toHaveBeenCalledTimes(1);
    log.mockRestore();
  });

  it('writes the summary read in place, freeing the lease', async () => {
    const { calls, db } = recording();
    await snapshotStore(db).write({ dossierId: 'd1', workspaceId: 'w1', summary: SUMMARY, readAt: '2026-10-05T09:00:00Z' });
    expect(calls).toEqual([['dossier_github', ['upsert',
      { dossier_id: 'd1', workspace_id: 'w1', summary: SUMMARY, read_at: '2026-10-05T09:00:00Z', refreshing_until: null }, { onConflict: 'dossier_id' }]]]);
  });

  it('marks stale only a current snapshot, and clears only a mark set before the read', async () => {
    const { calls, db } = recording();
    await snapshotStore(db).markStale('d1', '2026-10-05T09:00:00Z');
    await snapshotStore(db).current('d1', '2026-10-05T09:01:00Z');
    expect(calls).toEqual([
      ['dossier_github', ['update', { stale_since: '2026-10-05T09:00:00Z' }], ['eq', 'dossier_id', 'd1'], ['is', 'stale_since', null]],
      ['dossier_github', ['update', { stale_since: null }], ['eq', 'dossier_id', 'd1'], ['lte', 'stale_since', '2026-10-05T09:01:00Z']],
    ]);
  });

  it('takes the lease only when none holds, and says whether it did', async () => {
    const taken = recording({ data: [{ dossier_id: 'd1' }], error: null });
    expect(await snapshotStore(taken.db).lease('d1', '2026-10-05T09:00:00Z', '2026-10-05T09:01:00Z')).toBe(true);
    expect(taken.calls).toEqual([['dossier_github', ['update', { refreshing_until: '2026-10-05T09:01:00Z' }], ['eq', 'dossier_id', 'd1'],
      ['or', 'refreshing_until.is.null,refreshing_until.lt.2026-10-05T09:00:00Z'], ['select', 'dossier_id']]]);
    expect(await snapshotStore(recording({ data: [], error: null }).db).lease('d1', 'a', 'b')).toBe(false);
  });

  it('frees the lease', async () => {
    const { calls, db } = recording();
    await snapshotStore(db).release('d1');
    expect(calls).toEqual([['dossier_github', ['update', { refreshing_until: null }], ['eq', 'dossier_id', 'd1']]]);
  });

  it('finds a PRD\'s dossier by its repository, whatever its case, wildcards escaped', async () => {
    const { calls, db } = recording({ data: { id: 'd1' }, error: null });
    expect(await snapshotStore(db).dossierOf('w1', 'acme/my_widgets', parsePrd(7))).toBe('d1');
    expect(calls).toEqual([['dossiers', ['select', 'id'], ['eq', 'workspace_id', 'w1'], ['ilike', 'home_repo', 'acme/my\\_widgets'],
      ['eq', 'prd', 7], ['eq', 'kind', 'prd'], ['limit', 1], ['maybeSingle']]]);
    expect(await snapshotStore(recording().db).dossierOf('w1', 'acme/widgets', parsePrd(7))).toBeNull();
  });

  it('throws with Supabase\'s reason on a refusal', async () => {
    const { db } = recording({ data: null, error: { message: 'permission denied', code: '42501' } });
    await expect(snapshotStore(db).read('d1')).rejects.toThrow('permission denied (42501)');
    await expect(snapshotStore(db).markStale('d1', 'a')).rejects.toThrow('permission denied (42501)');
    await expect(snapshotStore(db).lease('d1', 'a', 'b')).rejects.toThrow('permission denied (42501)');
  });
});

describe('the fake', () => {
  it('keeps a stale mark through a write, and refuses a held lease', async () => {
    const store = fakeSnapshotStore();
    expect(await store.lease('d1', 'a', 'b')).toBe(false);
    await store.write({ dossierId: 'd1', workspaceId: 'w1', summary: SUMMARY, readAt: '2026-10-05T09:00:00Z' });
    await store.markStale('d1', '2026-10-05T09:05:00Z');
    await store.markStale('d1', '2026-10-05T09:06:00Z');
    await store.write({ dossierId: 'd1', workspaceId: 'w1', summary: SUMMARY, readAt: '2026-10-05T09:07:00Z' });
    expect((await store.read('d1'))?.staleSince).toBe('2026-10-05T09:05:00Z');
    expect(await store.lease('d1', '2026-10-05T09:07:00Z', '2026-10-05T09:08:00Z')).toBe(true);
    expect(await store.lease('d1', '2026-10-05T09:07:30Z', '2026-10-05T09:08:30Z')).toBe(false);
  });
});
