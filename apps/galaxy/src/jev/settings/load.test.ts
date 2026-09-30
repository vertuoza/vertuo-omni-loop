import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const read = vi.hoisted(() => ({
  workspace: (async () => ({ id: 'ws-1', slug: 'vertuoza', name: 'Vertuoza', theme: {} })) as () => Promise<unknown>,
}));
vi.mock('../../data/workspace', () => ({ memberWorkspace: () => read.workspace() }));

import type { SupabaseClient, User } from '@supabase/supabase-js';
import { loadJevPage } from './load';

// Settings › Jev's read (PRD 812 s1, s2): the workspace, the caller's role, the key's status and the
// decisions' settings, as the
// signed-in person (stubbed: no test calls Supabase).

const USER = { id: 'u-1' } as User;

type Answer = { data?: unknown; error?: { message: string; code?: string } | null } | Error;

const DECISION_ROWS = [{ decision: 'question-category', mode: 'shadow', threshold: '0.50', confidence_floor: '0.40' }];
const NOW = new Date('2026-09-30T12:00:00Z');
const CALL_ROWS = [
  { id: 2, decision: 'question-category', mode: 'shadow', outcome: 'answered', model: 'jev-1.13.0', jev_answer: 'ux', confidence: '0.80', old_answer: 'product', counted: 'product', decided_by: 'old', ref: 'round:r-2', reason: null, ms: 90, called_at: '2026-09-29T10:00:00Z' },
  { id: 1, decision: 'question-category', mode: 'shadow', outcome: 'answered', model: 'jev-1.13.0', jev_answer: 'product', confidence: '0.70', old_answer: 'product', counted: 'product', decided_by: 'old', ref: 'round:r-1', reason: null, ms: 80, called_at: '2026-09-28T10:00:00Z' },
];

function db({
  owner = { data: true } as Answer,
  status = { data: [{ stored: true, last_four: '1a2b', set_at: '2026-09-30T10:00:00Z' }] } as Answer,
  decisions = { data: DECISION_ROWS } as { data?: unknown; error?: { message: string; code?: string } | null },
  calls: callsIn = { data: CALL_ROWS } as { data?: unknown; error?: { message: string; code?: string } | null },
} = {}) {
  const calls: unknown[] = [];
  return {
    calls,
    client: {
      rpc: async (fn: string, args: unknown) => {
        calls.push([fn, args]);
        const answer = fn === 'is_owner' ? owner : status;
        if (answer instanceof Error) throw answer;
        return { data: answer.data ?? null, error: answer.error ?? null };
      },
      // The decisions' read (PRD 812 s2): from('jev_decisions').select(…).eq('workspace_id', …); the
      // calls' read (PRD 812 s4): from('jev_calls').select(…).eq(…).gte('called_at', …).order(…).
      from: (table: string) => ({
        select: () => ({
          eq: (column: string, value: unknown) => {
            calls.push(['from', table, column, value]);
            const answer = table === 'jev_calls' ? callsIn : decisions;
            const settled = Promise.resolve({ data: answer.data ?? null, error: answer.error ?? null });
            return Object.assign(settled, {
              gte: (col: string, since: unknown) => {
                calls.push(['gte', col, since]);
                return { order: async () => ({ data: answer.data ?? null, error: answer.error ?? null }) };
              },
            });
          },
        }),
      }),
    } as unknown as SupabaseClient,
  };
}

describe('loadJevPage', () => {
  it('reads the workspace, the role and the key\'s status', async () => {
    const { client, calls } = db();
    expect(await loadJevPage(client, USER, NOW)).toMatchObject({
      kind: 'jev', workspace: { id: 'ws-1', name: 'Vertuoza' }, owner: true,
      keyStatus: { stored: true, lastFour: '1a2b', setAt: '2026-09-30T10:00:00Z' },
      decisions: [{ decision: 'question-category', mode: 'shadow', threshold: 0.5, floor: 0.4 }],
    });
    expect(calls).toEqual(expect.arrayContaining([['is_owner', { workspace: 'ws-1' }], ['jev_key_status', { p_workspace: 'ws-1' }], ['from', 'jev_decisions', 'workspace_id', 'ws-1']]));
  });

  it('reads the last 30 days of calls into each decision\'s record (PRD 812 s4)', async () => {
    const { client, calls } = db();
    const got = await loadJevPage(client, USER, NOW);
    expect(calls).toEqual(expect.arrayContaining([['from', 'jev_calls', 'workspace_id', 'ws-1'], ['gte', 'called_at', '2026-08-31T12:00:00.000Z']]));
    expect(got).toMatchObject({ kind: 'jev', records: { 'question-category': { calls: 2, compared: 2, agreed: 1, agreement: 0.5 } } });
    if (got.kind !== 'jev') throw new Error('no page');
    expect(got.records?.['question-category'].disagreements.map((d) => d.ref)).toEqual([{ text: 'the round', href: '/ask/q/r-2' }]);
    expect(got.records?.['outbox-risk']).toMatchObject({ calls: 0, agreement: null });
  });

  it('shows the page without a record when the calls cannot be read', async () => {
    const got = await loadJevPage(db({ calls: { error: { message: 'down' } } }).client, USER, NOW);
    expect(got).toMatchObject({ kind: 'jev', owner: true, records: null });
  });

  it('reads a role that cannot be read as a member\'s', async () => {
    const got = await loadJevPage(db({ owner: new Error('down') }).client, USER);
    expect(got).toMatchObject({ kind: 'jev', owner: false });
  });

  it('is no-workspace for an account in none, and unreadable when the key\'s status cannot be read', async () => {
    const before = read.workspace;
    read.workspace = async () => null;
    expect(await loadJevPage(db().client, USER)).toEqual({ kind: 'no-workspace' });
    read.workspace = before;
    expect(await loadJevPage(db({ status: { error: { message: 'no', code: '42501' } } }).client, USER)).toEqual({ kind: 'unreadable' });
    expect(await loadJevPage(db({ decisions: { error: { message: 'no' } } }).client, USER)).toEqual({ kind: 'unreadable' });
  });
});
