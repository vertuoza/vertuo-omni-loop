// The sync's snapshot store (PRD 902, s4): its Supabase calls on a recording client. No test reaches
// Supabase.
import { describe, expect, it } from 'vitest';
import { parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { syncSnapshotStore } from './snapshots';

type Answer = { data: unknown; error: { message: string; code?: string } | null };

/** A client that records each chain of calls on a table, and answers the n-th chain with `answers[n]`. */
function recording(...answers: Answer[]) {
  const calls: unknown[][] = [];
  const from = (table: string) => {
    const call: unknown[] = [table];
    const answer = answers[calls.length] ?? { data: null, error: null };
    calls.push(call);
    const chain: Record<string, unknown> = {};
    for (const name of ['select', 'update', 'delete', 'eq', 'is', 'not', 'lt', 'in', 'ilike']) {
      chain[name] = (...args: unknown[]) => { call.push([name, ...args]); return chain; };
    }
    chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(answer).then(resolve);
    return chain;
  };
  return { calls, db: { from } as never };
}

const AT = '2026-10-05T12:00:00.000Z';

describe('the sync\'s snapshot store, on Supabase', () => {
  it('marks stale the current snapshots of the repository\'s changed PRDs, in one update', async () => {
    const { calls, db } = recording({ data: [{ id: 'd7' }, { id: 'd9' }], error: null });
    await syncSnapshotStore(db).markChanged('w1', 'Acme/My_Repo', [parsePrd(7), parsePrd(9)], AT);
    expect(calls).toEqual([
      ['dossiers', ['select', 'id'], ['eq', 'workspace_id', 'w1'], ['eq', 'kind', 'prd'], ['ilike', 'home_repo', 'Acme/My\\_Repo'], ['in', 'prd', [7, 9]]],
      ['dossier_github', ['update', { stale_since: AT }], ['in', 'dossier_id', ['d7', 'd9']], ['is', 'stale_since', null]],
    ]);
  });

  it('marks nothing when no changed PRD has a dossier', async () => {
    const { calls, db } = recording({ data: [], error: null });
    await syncSnapshotStore(db).markChanged('w1', 'acme/widgets', [parsePrd(7)], AT);
    expect(calls.length).toBe(1);
  });

  it('marks stale every current snapshot of the workspace read before the cut', async () => {
    const { calls, db } = recording();
    await syncSnapshotStore(db).markOld('w1', '2026-10-05T06:00:00.000Z', AT);
    expect(calls).toEqual([
      ['dossier_github', ['update', { stale_since: AT }], ['eq', 'workspace_id', 'w1'], ['lt', 'read_at', '2026-10-05T06:00:00.000Z'], ['is', 'stale_since', null]],
    ]);
  });

  it('lists the repository\'s stale snapshots as dossiers', async () => {
    const { calls, db } = recording({ data: [{ dossier_id: 'd7', dossiers: { home_repo: 'acme/widgets', prd: 7 } }], error: null });
    expect(await syncSnapshotStore(db).stale('w1', 'acme/widgets')).toEqual([{ id: 'd7', home_repo: 'acme/widgets', prd: parsePrd(7) }]);
    expect(calls).toEqual([
      ['dossier_github', ['select', 'dossier_id, dossiers!inner(home_repo, prd)'], ['eq', 'workspace_id', 'w1'], ['not', 'stale_since', 'is', null], ['ilike', 'dossiers.home_repo', 'acme/widgets']],
    ]);
  });

  it('refuses a stale row that is not a PRD dossier\'s', async () => {
    const { db } = recording({ data: [{ dossier_id: 'd7', dossiers: { home_repo: 'acme/widgets', prd: null } }], error: null });
    await expect(syncSnapshotStore(db).stale('w1', 'acme/widgets')).rejects.toThrow(/dossier_github/);
  });

  it('deletes the ETags not read since the cut', async () => {
    const { calls, db } = recording();
    await syncSnapshotStore(db).dropEtags('2026-09-28T12:00:00.000Z');
    expect(calls).toEqual([['github_etags', ['delete'], ['lt', 'read_at', '2026-09-28T12:00:00.000Z']]]);
  });

  it('throws with Supabase\'s reason on a refusal', async () => {
    const refusal = { data: null, error: { message: 'permission denied' } };
    await expect(syncSnapshotStore(recording(refusal).db).dropEtags(AT)).rejects.toThrow('Supabase refused to drop the idle ETags: permission denied');
    await expect(syncSnapshotStore(recording(refusal).db).markOld('w1', AT, AT)).rejects.toThrow(/permission denied/);
    await expect(syncSnapshotStore(recording(refusal).db).stale('w1', 'acme/widgets')).rejects.toThrow(/permission denied/);
    await expect(syncSnapshotStore(recording(refusal).db).markChanged('w1', 'acme/widgets', [parsePrd(7)], AT)).rejects.toThrow(/permission denied/);
    await expect(syncSnapshotStore(recording({ data: [{ id: 'd7' }], error: null }, refusal).db).markChanged('w1', 'acme/widgets', [parsePrd(7)], AT)).rejects.toThrow(/permission denied/);
  });
});
