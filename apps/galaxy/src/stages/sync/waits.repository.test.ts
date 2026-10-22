// The stored waits' repository (PRD 2377, s1): its Supabase calls on a recording client. No test reaches
// Supabase; supabase/checks/waits.sql proves the table's rules.
import { describe, expect, it } from 'vitest';
import { waitsRepository } from './waits.repository';
import { parsePr, parsePrd } from 'omni-loop/kit/lib/ids.ts';

type Answer = { data: unknown; error: { message: string } | null };

/** A client that records each chain of calls on a table and answers the n-th chain with `answers[n]`. */
function recording(...answers: Answer[]) {
  const calls: unknown[][] = [];
  const from = (table: string) => {
    const call: unknown[] = [table];
    const answer = answers[calls.length] ?? { data: null, error: null };
    calls.push(call);
    const chain: Record<string, unknown> = {};
    for (const name of ['select', 'eq', 'is', 'in', 'not', 'update', 'upsert', 'insert']) {
      chain[name] = (...args: unknown[]) => { call.push([name, ...args]); return chain; };
    }
    chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(answer).then(resolve);
    return chain;
  };
  return { calls, db: { from } as never };
}

const OPEN = { id: 'w1', prd: 42, pr: 9, kind: 'review', turn: ['rita'], since: '2026-10-05T00:00:00+00:00', seen_at: '2026-10-06T00:00:00+00:00' };

describe('the stored waits, on Supabase', () => {
  it('reads a repository\'s open waits, in lower case', async () => {
    const { calls, db } = recording({ data: [OPEN], error: null });
    expect(await waitsRepository(db).openWaits('w-acme', 'Acme/Widgets')).toEqual([OPEN]);
    expect(calls).toEqual([[
      'waits', ['select', 'id, prd, pr, kind, turn, since, seen_at'], ['is', 'ended_at', null], ['eq', 'workspace_id', 'w-acme'], ['eq', 'repo', 'acme/widgets'],
    ]]);
  });

  it('throws with Supabase\'s reason, or on a row out of shape', async () => {
    await expect(waitsRepository(recording({ data: null, error: { message: 'no access' } }).db).openWaits('w-acme', 'acme/widgets')).rejects.toThrow(/no access/);
    await expect(waitsRepository(recording({ data: [{ ...OPEN, kind: 'stuck' }], error: null }).db).openWaits('w-acme', 'acme/widgets')).rejects.toThrow();
  });

  it('ends, refreshes and opens in three writes, and writes nothing for nothing', async () => {
    const { calls, db } = recording();
    const seen = { prd: parsePrd(42), pr: parsePr(9), kind: 'merge' as const, turn: ['olga'], since: '2026-10-07T00:00:00Z', seen_at: '2026-10-08T00:00:00Z' };
    await waitsRepository(db).applyWaits('w-acme', 'Acme/Widgets', { ended: ['w0'], refreshed: [{ ...seen, id: 'w1' }], opened: [seen] }, '2026-10-08T00:00:00Z');
    const row = { workspace_id: 'w-acme', repo: 'acme/widgets', prd: 42, pr: 9, kind: 'merge', turn: ['olga'], since: '2026-10-07T00:00:00Z', seen_at: '2026-10-08T00:00:00Z' };
    expect(calls).toEqual([
      ['waits', ['update', { ended_at: '2026-10-08T00:00:00Z' }], ['in', 'id', ['w0']], ['is', 'ended_at', null]],
      ['waits', ['upsert', [{ id: 'w1', ...row }], { onConflict: 'id' }]],
      ['waits', ['insert', [row]]],
    ]);
    const none = recording();
    await waitsRepository(none.db).applyWaits('w-acme', 'acme/widgets', { ended: [], refreshed: [], opened: [] }, '2026-10-08T00:00:00Z');
    expect(none.calls).toEqual([]);
  });

  it('throws when a write is refused', async () => {
    const { db } = recording({ data: null, error: { message: 'duplicate key' } });
    await expect(waitsRepository(db).applyWaits('w-acme', 'acme/widgets', { ended: ['w0'], refreshed: [], opened: [] }, '2026-10-08T00:00:00Z'))
      .rejects.toThrow(/duplicate key/);
  });

  it('reads each PRD\'s owner\'s login: who opened its dossier, as their player row in the workspace names them', async () => {
    const { calls, db } = recording(
      { data: [{ prd: 42, opened_by: 'u-olga' }, { prd: 43, opened_by: 'u-nobody' }], error: null },
      { data: [{ user_id: 'u-olga', github_login: 'olga' }], error: null },
    );
    expect(await waitsRepository(db).owners('w-acme', 'Acme/Widgets', [parsePrd(42), parsePrd(43)])).toEqual(new Map([[42, 'olga']]));
    expect(calls).toEqual([
      ['dossiers', ['select', 'prd, opened_by'], ['eq', 'kind', 'prd'], ['not', 'prd', 'is', null], ['not', 'opened_by', 'is', null],
        ['eq', 'workspace_id', 'w-acme'], ['eq', 'home_repo', 'acme/widgets'], ['in', 'prd', [42, 43]]],
      ['players', ['select', 'user_id, github_login'], ['not', 'github_login', 'is', null], ['eq', 'workspace_id', 'w-acme'], ['in', 'user_id', ['u-olga', 'u-nobody']]],
    ]);
  });

  it('reads the approvers a repository\'s product asks: its products, those asked, their logins', async () => {
    const { calls, db } = recording(
      { data: [{ product_id: 'p1' }], error: null },
      { data: [{ user_id: 'u-rita' }, { user_id: 'u-anon' }], error: null },
      { data: [{ user_id: 'u-rita', github_login: 'rita' }], error: null },
    );
    expect(await waitsRepository(db).approvers('w-acme', 'Acme/Widgets')).toEqual(['rita']);
    expect(calls).toEqual([
      ['product_repositories', ['select', 'product_id'], ['eq', 'workspace_id', 'w-acme'], ['eq', 'repository', 'acme/widgets']],
      ['product_approvers', ['select', 'user_id'], ['eq', 'state', 'asked'], ['eq', 'workspace_id', 'w-acme'], ['in', 'product_id', ['p1']]],
      ['players', ['select', 'user_id, github_login'], ['not', 'github_login', 'is', null], ['eq', 'workspace_id', 'w-acme'], ['in', 'user_id', ['u-rita', 'u-anon']]],
    ]);
  });

  it('reads no approver for a repository of no product, or a product that asks nobody', async () => {
    const none = recording({ data: [], error: null });
    expect(await waitsRepository(none.db).approvers('w-acme', 'acme/widgets')).toEqual([]);
    expect(none.calls).toHaveLength(1);
    const nobody = recording({ data: [{ product_id: 'p1' }], error: null }, { data: [], error: null });
    expect(await waitsRepository(nobody.db).approvers('w-acme', 'acme/widgets')).toEqual([]);
    expect(nobody.calls).toHaveLength(2);
    await expect(waitsRepository(recording({ data: null, error: { message: 'no access' } }).db).approvers('w-acme', 'acme/widgets')).rejects.toThrow(/no access/);
  });

  it('reads each PRD\'s stored open items, and when it reached stage prd', async () => {
    const item = { id: 'q1', rank: 'high', question: 'Which?', asked: ['sam'] };
    const outboxes = recording({ data: [{ prd: 42, waiting: [item, { nonsense: true }] }], error: null });
    expect(await waitsRepository(outboxes.db).outboxes('w-acme', 'Acme/Widgets', [parsePrd(42)])).toEqual(new Map([[42, [item]]]));
    expect(outboxes.calls).toEqual([['prd_outbox', ['select', 'prd, waiting'], ['eq', 'workspace_id', 'w-acme'], ['eq', 'repository', 'acme/widgets'], ['in', 'prd', [42]]]]);
    const stages = recording({ data: [{ prd: 7, reached_at: '2026-10-02T00:00:00+00:00' }], error: null });
    expect(await waitsRepository(stages.db).reached('w-acme', 'Acme/Widgets', [parsePrd(7)])).toEqual(new Map([[7, '2026-10-02T00:00:00+00:00']]));
    expect(stages.calls).toEqual([['prd_stages', ['select', 'prd, reached_at'], ['eq', 'stage', 'prd'], ['eq', 'workspace_id', 'w-acme'], ['eq', 'repository', 'acme/widgets'], ['in', 'prd', [7]]]]);
    const none = recording();
    expect(await waitsRepository(none.db).outboxes('w-acme', 'acme/widgets', [])).toEqual(new Map());
    expect(await waitsRepository(none.db).reached('w-acme', 'acme/widgets', [])).toEqual(new Map());
    expect(none.calls).toEqual([]);
    await expect(waitsRepository(recording({ data: null, error: { message: 'no access' } }).db).outboxes('w-acme', 'acme/widgets', [parsePrd(42)])).rejects.toThrow(/no access/);
    await expect(waitsRepository(recording({ data: null, error: { message: 'no access' } }).db).reached('w-acme', 'acme/widgets', [parsePrd(7)])).rejects.toThrow(/no access/);
  });

  it('reads nothing for no PRD, and no player when no dossier was opened by someone', async () => {
    const none = recording();
    expect(await waitsRepository(none.db).owners('w-acme', 'acme/widgets', [])).toEqual(new Map());
    expect(none.calls).toEqual([]);
    const unopened = recording({ data: [], error: null });
    expect(await waitsRepository(unopened.db).owners('w-acme', 'acme/widgets', [parsePrd(42)])).toEqual(new Map());
    expect(unopened.calls).toHaveLength(1);
  });
});
