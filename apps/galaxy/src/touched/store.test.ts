// The snapshots a touch is matched against (PRD 902, s3): its Supabase call on a recording client. No
// test reaches Supabase.
import { describe, expect, it, vi } from 'vitest';
import { parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';
import type { GithubSummary } from '../dossier/github/summary';
import { snapshotsOf } from './store';

const SUMMARY: GithubSummary = {
  repo: 'acme/widgets', prd: parsePrd(7), folder: null, topic: null, issue: null, phase0: null, feature: null, retro: null, mergedSlices: 0,
};

function recording(answer: { data: unknown; error: { message: string } | null }) {
  const calls: unknown[][] = [];
  const from = (table: string) => {
    const call: unknown[] = [table];
    calls.push(call);
    const chain: Record<string, unknown> = {};
    for (const name of ['select', 'eq']) chain[name] = (...args: unknown[]) => { call.push([name, ...args]); return chain; };
    chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(answer).then(resolve);
    return chain;
  };
  return { calls, db: { from } as never };
}

describe('snapshotsOf', () => {
  it('reads the workspace\'s snapshots, each summary parsed', async () => {
    const { calls, db } = recording({ data: [{ dossier_id: 'd1', summary: SUMMARY }], error: null });
    expect(await snapshotsOf(db, 'w1')).toEqual([{ dossierId: 'd1', summary: SUMMARY }]);
    expect(calls).toEqual([['dossier_github', ['select', 'dossier_id, summary'], ['eq', 'workspace_id', 'w1']]]);
  });

  it('leaves out a row whose summary does not parse, and logs it, keeping the others', async () => {
    const log = vi.fn();
    const { db } = recording({ data: [{ dossier_id: 'd1', summary: { repo: 1 } }, { dossier_id: 'd2', summary: SUMMARY }], error: null });
    expect(await snapshotsOf(db, 'w1', log)).toEqual([{ dossierId: 'd2', summary: SUMMARY }]);
    expect(log).toHaveBeenCalledTimes(1);
  });

  it('throws Supabase\'s reason on a refusal', async () => {
    const { db } = recording({ data: null, error: { message: 'denied' } });
    await expect(snapshotsOf(db, 'w1')).rejects.toThrow('denied');
  });
});
