// The snapshots a touch is matched against (PRD 902, s3): its Supabase call on a recording client. No
// test reaches Supabase.
import { describe, expect, it, vi } from 'vitest';
import { parsePrd } from 'omni-loop/kit/lib/ids.ts';
import type { GithubSummary } from '../dossier/github/summary';
import { parseIssue } from 'omni-loop/kit/lib/ids.ts';
import { conceptOf, snapshotsOf } from './store';

const SUMMARY: GithubSummary = {
  repo: 'acme/widgets', prd: parsePrd(7), folder: null, topic: null, issue: null, phase0: null, feature: null, retro: null, mergedSlices: 0,
};

function recording(answer: { data: unknown; error: { message: string } | null }) {
  const calls: unknown[][] = [];
  const from = (table: string) => {
    const call: unknown[] = [table];
    calls.push(call);
    const chain: Record<string, unknown> = {};
    for (const name of ['select', 'eq', 'ilike', 'limit']) chain[name] = (...args: unknown[]) => { call.push([name, ...args]); return chain; };
    chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(answer).then(resolve);
    return chain;
  };
  return { calls, db: { from } as never };
}

describe('snapshotsOf', () => {
  it('reads the snapshots of the workspace\'s repository, each summary parsed', async () => {
    const { calls, db } = recording({ data: [{ dossier_id: 'd1', summary: SUMMARY }], error: null });
    expect(await snapshotsOf(db, 'w1', 'acme/widgets')).toEqual([{ dossierId: 'd1', summary: SUMMARY }]);
    expect(calls).toEqual([['dossier_github', ['select', 'dossier_id, summary'], ['eq', 'workspace_id', 'w1'], ['ilike', 'summary->>repo', 'acme/widgets']]]);
  });

  it('leaves out a row whose summary does not parse, and logs it, keeping the others', async () => {
    const log = vi.fn();
    const { db } = recording({ data: [{ dossier_id: 'd1', summary: { repo: 1 } }, { dossier_id: 'd2', summary: SUMMARY }], error: null });
    expect(await snapshotsOf(db, 'w1', 'acme/widgets', log)).toEqual([{ dossierId: 'd2', summary: SUMMARY }]);
    expect(log).toHaveBeenCalledTimes(1);
  });

  it('throws Supabase\'s reason on a refusal', async () => {
    const { db } = recording({ data: null, error: { message: 'denied' } });
    await expect(snapshotsOf(db, 'w1', 'acme/widgets')).rejects.toThrow('denied');
  });

  it('reads only the snapshots of the touched repository, in any case, not the whole workspace (#1854)', async () => {
    const { calls, db } = recording({ data: [{ dossier_id: 'd1', summary: SUMMARY }], error: null });
    expect(await snapshotsOf(db, 'w1', 'Acme/Widgets_2%')).toEqual([{ dossierId: 'd1', summary: SUMMARY }]);
    expect(calls).toEqual([['dossier_github', ['select', 'dossier_id, summary'], ['eq', 'workspace_id', 'w1'], ['ilike', 'summary->>repo', 'Acme/Widgets\\_2\\%']]]);
  });
});

describe('conceptOf', () => {
  it('reads the workspace\'s concept dossier of the repository whose number is the issue\'s', async () => {
    const { calls, db } = recording({ data: [{ id: 'c1', home_repo: 'Acme/Widgets', prd: 12 }], error: null });
    expect(await conceptOf(db, 'w1', 'Acme/Widgets', parseIssue(12))).toEqual({ id: 'c1', home_repo: 'Acme/Widgets', prd: 12 });
    expect(calls).toEqual([['dossiers', ['select', 'id, home_repo, prd'], ['eq', 'workspace_id', 'w1'], ['eq', 'kind', 'concept'], ['eq', 'prd', 12],
      ['ilike', 'home_repo', 'Acme/Widgets'], ['limit', 1]]]);
  });

  it('is null when the issue is no concept\'s, and throws Supabase\'s reason on a refusal', async () => {
    expect(await conceptOf(recording({ data: [], error: null }).db, 'w1', 'acme/widgets', parseIssue(3))).toBeNull();
    await expect(conceptOf(recording({ data: null, error: { message: 'denied' } }).db, 'w1', 'acme/widgets', parseIssue(3))).rejects.toThrow('denied');
  });
});
