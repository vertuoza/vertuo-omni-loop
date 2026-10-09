// The sync's read of the PRDs born on the server (PRD 1299, s6): its Supabase call on a recording client.
// No test reaches Supabase.
import { describe, expect, it } from 'vitest';
import { serverBornStore } from './approvals';

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

describe('the PRDs born on the server, on Supabase', () => {
  it('reads the repository\'s ◆ PRD dossiers with their approvals, in one select', async () => {
    const { calls, db } = recording({ data: [], error: null });
    await serverBornStore(db).serverBorn('w1', 'Acme/Widgets');
    expect(calls).toEqual([[
      'dossiers', ['select', 'prd, approvals(approved_at)'], ['eq', 'workspace_id', 'w1'], ['eq', 'kind', 'prd'],
      ['eq', 'birthplace', 'server'], ['eq', 'home_repo', 'acme/widgets'], ['not', 'prd', 'is', null],
    ]]);
  });

  it('gives each PRD its first approval, and null while it waits', async () => {
    const { db } = recording({
      data: [
        { prd: 7, approvals: [{ approved_at: '2026-10-09T11:00:00+00:00' }, { approved_at: '2026-10-08T09:30:00+00:00' }] },
        { prd: 9, approvals: [] },
      ],
      error: null,
    });
    expect(await serverBornStore(db).serverBorn('w1', 'acme/widgets')).toEqual([
      { prd: 7, approved_at: '2026-10-08T09:30:00.000Z' },
      { prd: 9, approved_at: null },
    ]);
  });

  it('throws with Supabase\'s reason when it refuses, or a row out of shape', async () => {
    await expect(serverBornStore(recording({ data: null, error: { message: 'no access' } }).db).serverBorn('w1', 'acme/widgets'))
      .rejects.toThrow(/no access/);
    await expect(serverBornStore(recording({ data: [{ prd: 'seven', approvals: [] }], error: null }).db).serverBorn('w1', 'acme/widgets'))
      .rejects.toThrow();
  });
});
