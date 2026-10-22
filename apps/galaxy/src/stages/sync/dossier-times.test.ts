// The sync's read of the PRD dossiers' times (PRD 2370, s3): its Supabase call on a recording client.
// No test reaches Supabase.
import { describe, expect, it } from 'vitest';
import { dossierTimesStore } from './dossier-times.repository';

type Answer = { data: unknown; error: { message: string } | null };

/** A client that records its chain of calls on a table and answers with `answer`. */
function recording(answer: Answer) {
  const calls: unknown[][] = [];
  const from = (table: string) => {
    const call: unknown[] = [table];
    calls.push(call);
    const chain: Record<string, unknown> = {};
    for (const name of ['select', 'eq', 'not']) {
      chain[name] = (...args: unknown[]) => { call.push([name, ...args]); return chain; };
    }
    chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(answer).then(resolve);
    return chain;
  };
  return { calls, db: { from } as never };
}

describe('the PRD dossiers\' times, on Supabase', () => {
  it('reads the repository\'s numbered PRD dossiers with their plan versions, in one select', async () => {
    const { calls, db } = recording({ data: [], error: null });
    await dossierTimesStore(db).dossierTimes('w1', 'Acme/Widgets');
    expect(calls).toEqual([[
      'dossiers', ['select', 'prd, created_at, dossier_versions(created_at)'], ['eq', 'kind', 'prd'], ['not', 'prd', 'is', null],
      ['eq', 'dossier_versions.kind', 'plan'], ['eq', 'workspace_id', 'w1'], ['eq', 'home_repo', 'acme/widgets'],
    ]]);
  });

  it('gives each PRD its dossier\'s opening and its earliest plan version, null while there is none', async () => {
    const { db } = recording({
      data: [
        { prd: 7, created_at: '2026-10-01T09:00:00+00:00', dossier_versions: [{ created_at: '2026-10-03T09:00:00+00:00' }, { created_at: '2026-10-02T09:00:00+00:00' }] },
        { prd: 9, created_at: '2026-10-04T09:00:00+00:00', dossier_versions: [] },
      ],
      error: null,
    });
    expect(await dossierTimesStore(db).dossierTimes('w1', 'acme/widgets')).toEqual([
      { prd: 7, opened_at: '2026-10-01T09:00:00.000Z', plan_at: '2026-10-02T09:00:00.000Z' },
      { prd: 9, opened_at: '2026-10-04T09:00:00.000Z', plan_at: null },
    ]);
  });

  it('throws with Supabase\'s reason when it refuses, or a row out of shape', async () => {
    await expect(dossierTimesStore(recording({ data: null, error: { message: 'no access' } }).db).dossierTimes('w1', 'acme/widgets')).rejects.toThrow(/no access/);
    await expect(dossierTimesStore(recording({ data: [{ prd: 7, created_at: 'never', dossier_versions: [] }], error: null }).db).dossierTimes('w1', 'acme/widgets')).rejects.toThrow();
  });
});
