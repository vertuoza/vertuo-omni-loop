import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const read = vi.hoisted(() => ({
  workspace: (async () => ({ id: 'ws-1', slug: 'vertuoza', name: 'Vertuoza', theme: {} })) as () => Promise<unknown>,
}));
vi.mock('../../data/workspace', () => ({ memberWorkspace: () => read.workspace() }));

import type { SupabaseClient, User } from '@supabase/supabase-js';
import { loadJevPage } from './load';

// Settings › Jev's read (PRD 812 s1): the workspace, the caller's role and the key's status, as the
// signed-in person (stubbed: no test calls Supabase).

const USER = { id: 'u-1' } as User;

type Answer = { data?: unknown; error?: { message: string; code?: string } | null } | Error;

function db({ owner = { data: true } as Answer, status = { data: [{ stored: true, last_four: '1a2b', set_at: '2026-09-30T10:00:00Z' }] } as Answer } = {}) {
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
    } as unknown as SupabaseClient,
  };
}

describe('loadJevPage', () => {
  it('reads the workspace, the role and the key\'s status', async () => {
    const { client, calls } = db();
    expect(await loadJevPage(client, USER)).toEqual({
      kind: 'jev', workspace: { id: 'ws-1', name: 'Vertuoza' }, owner: true,
      keyStatus: { stored: true, lastFour: '1a2b', setAt: '2026-09-30T10:00:00Z' },
    });
    expect(calls).toEqual([['is_owner', { workspace: 'ws-1' }], ['jev_key_status', { p_workspace: 'ws-1' }]]);
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
  });
});
