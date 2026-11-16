// The snapshots a touch is matched against (PRD 902, s3): its Supabase call on a recording client. No
// test reaches Supabase.
import { describe, expect, it, vi } from 'vitest';
import { parsePrd } from 'omni-loop/kit/lib/ids.ts';
import type { GithubSummary } from '../dossier/github/summary';
import { parseIssue } from 'omni-loop/kit/lib/ids.ts';
import { conceptOf, snapshotOf, snapshotsOf } from './store';

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
  const ROW = { dossier_id: 'd1', prd: 7, issue: null, pulls: [], dossiers: { home_repo: 'acme/widgets' } };
  const KEYS = { dossierId: 'd1', repo: 'acme/widgets', prd: 7, issue: null, pulls: [] };
  const SELECT = ['select', 'dossier_id, prd, issue, pulls, dossiers(home_repo)'];

  it('reads the snapshots of the workspace\'s repository, each as the keys a touch matches on', async () => {
    const { calls, db } = recording({ data: [ROW], error: null });
    expect(await snapshotsOf(db, 'w1', 'acme/widgets')).toEqual([KEYS]);
    expect(calls).toEqual([['dossier_github', SELECT, ['eq', 'workspace_id', 'w1'], ['eq', 'repo', 'acme/widgets']]]);
  });

  it('leaves out a row whose keys do not parse, and logs it, keeping the others', async () => {
    const log = vi.fn();
    const { db } = recording({ data: [{ ...ROW, dossier_id: 'd0', prd: null }, ROW], error: null });
    expect(await snapshotsOf(db, 'w1', 'acme/widgets', log)).toEqual([KEYS]);
    expect(log).toHaveBeenCalledTimes(1);
  });

  it('throws Supabase\'s reason on a refusal', async () => {
    const { db } = recording({ data: null, error: { message: 'denied' } });
    await expect(snapshotsOf(db, 'w1', 'acme/widgets')).rejects.toThrow('denied');
  });

  it('reads only the snapshots of the touched repository, in any case, not the whole workspace (#1854)', async () => {
    const { calls, db } = recording({ data: [ROW], error: null });
    expect(await snapshotsOf(db, 'w1', 'ACME/WIDGETS')).toEqual([KEYS]);
    expect(calls).toEqual([['dossier_github', SELECT, ['eq', 'workspace_id', 'w1'], ['eq', 'repo', 'acme/widgets']]]);
  });

  it('filters on the indexed lower-case repo column, never on the jsonb summary, so no summary is read to filter (#2952)', async () => {
    const { calls, db } = recording({ data: [ROW], error: null });
    expect(await snapshotsOf(db, 'w1', 'Acme/Widgets_2%')).toEqual([KEYS]);
    expect(calls).toEqual([['dossier_github', SELECT, ['eq', 'workspace_id', 'w1'], ['eq', 'repo', 'acme/widgets_2%']]]);
  });

  it('reads only the keys a touch matches on, never the whole summary of each snapshot (#2970)', async () => {
    const row = { dossier_id: 'd1', prd: 7, issue: 7, pulls: [8, 9], dossiers: { home_repo: 'Acme/Widgets' } };
    const { calls, db } = recording({ data: [row], error: null });
    expect(await snapshotsOf(db, 'w1', 'Acme/Widgets')).toEqual([{ dossierId: 'd1', repo: 'Acme/Widgets', prd: 7, issue: 7, pulls: [8, 9] }]);
    expect(calls).toEqual([['dossier_github', ['select', 'dossier_id, prd, issue, pulls, dossiers(home_repo)'], ['eq', 'workspace_id', 'w1'],
      ['eq', 'repo', 'acme/widgets']]]);
  });
});

describe('snapshotOf', () => {
  it('reads one PRD\'s snapshot whole, by its stored PRD number in the repository', async () => {
    const { calls, db } = recording({ data: [{ dossier_id: 'd1', summary: SUMMARY }], error: null });
    expect(await snapshotOf(db, 'w1', 'Acme/Widgets', parsePrd(7))).toEqual(SUMMARY);
    expect(calls).toEqual([['dossier_github', ['select', 'dossier_id, summary'], ['eq', 'workspace_id', 'w1'], ['eq', 'repo', 'acme/widgets'],
      ['eq', 'prd', 7], ['limit', 1]]]);
  });

  it('is null when there is none, and when its summary does not parse (logged)', async () => {
    const log = vi.fn();
    expect(await snapshotOf(recording({ data: [], error: null }).db, 'w1', 'acme/widgets', parsePrd(7), log)).toBeNull();
    expect(await snapshotOf(recording({ data: [{ dossier_id: 'd1', summary: { repo: 1 } }], error: null }).db, 'w1', 'acme/widgets', parsePrd(7), log))
      .toBeNull();
    expect(log).toHaveBeenCalledTimes(1);
  });

  it('throws Supabase\'s reason on a refusal', async () => {
    await expect(snapshotOf(recording({ data: null, error: { message: 'denied' } }).db, 'w1', 'acme/widgets', parsePrd(7))).rejects.toThrow('denied');
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
