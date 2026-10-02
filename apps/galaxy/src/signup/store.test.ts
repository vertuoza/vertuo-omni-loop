import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { signupStore } from './store';

type Call = { op: string; args: unknown[] };

/** The service role's client, as far as the store reaches it: each call recorded, each answer given. */
function stubDb(answer: { data?: unknown; error?: { message: string } | null } = {}) {
  const calls: Call[] = [];
  const result = { data: answer.data ?? null, error: answer.error ?? null };
  const chain = (): Record<string, unknown> => {
    const q: Record<string, unknown> = {};
    for (const op of ['select', 'insert', 'upsert', 'delete', 'eq']) {
      q[op] = (...args: unknown[]) => { calls.push({ op, args }); return q; };
    }
    q.then = (resolve: (v: unknown) => void) => {
      resolve(result);
    };
    return q;
  };
  const db = {
    rpc: (fn: string, args: unknown) => { calls.push({ op: 'rpc', args: [fn, args] }); return Promise.resolve(result); },
    from: (table: string) => { calls.push({ op: 'from', args: [table] }); return chain(); },
  };
  return { db: db as unknown as SupabaseClient, calls };
}

const ACME = { id: 5001, account: { login: 'Acme', type: 'Organization' as const } };

describe('the sign-up store, as the service role', () => {
  it('makes a workspace from an installation, with its account\'s login and type', async () => {
    const { db, calls } = stubDb({ data: { workspace_id: 'ws-1', slug: 'acme', role: 'owner', created: true } });
    expect(await signupStore(db).createWorkspace('user-owen', ACME)).toEqual({ workspaceId: 'ws-1', slug: 'acme', role: 'owner', created: true });
    expect(calls).toEqual([{ op: 'rpc', args: ['create_workspace_from_installation', { p_user_id: 'user-owen', p_installation_id: 5001, p_login: 'Acme', p_type: 'Organization' }] }]);
  });

  it('throws when the database refuses, or answers an odd shape', async () => {
    await expect(signupStore(stubDb({ error: { message: 'permission denied' } }).db).createWorkspace('u', ACME)).rejects.toThrow(/permission denied/);
    await expect(signupStore(stubDb({ data: { slug: 'acme' } }).db).createWorkspace('u', ACME)).rejects.toThrow(/shape/);
  });

  it('reads the person\'s pending requests', async () => {
    const { db, calls } = stubDb({ data: [{ github_org: 'acme' }, { github_org: 'Globex' }] });
    expect(await signupStore(db).pendingRequests('user-mia')).toEqual(['acme', 'Globex']);
    expect(calls).toEqual([
      { op: 'from', args: ['signup_requests'] },
      { op: 'select', args: ['github_org'] },
      { op: 'eq', args: ['user_id', 'user-mia'] },
    ]);
  });

  it('reads no pending requests as none, and throws on an odd shape', async () => {
    expect(await signupStore(stubDb().db).pendingRequests('user-mia')).toEqual([]);
    await expect(signupStore(stubDb({ data: [{ org: 'acme' }] }).db).pendingRequests('user-mia')).rejects.toThrow(/shape/);
  });

  it('records a request once, however often it is made', async () => {
    const { db, calls } = stubDb();
    await signupStore(db).recordRequest('user-mia', 'acme');
    expect(calls).toEqual([
      { op: 'from', args: ['signup_requests'] },
      { op: 'upsert', args: [{ user_id: 'user-mia', github_org: 'acme' }, { onConflict: 'user_id,github_org', ignoreDuplicates: true }] },
    ]);
  });

  it('drops a completed request', async () => {
    const { db, calls } = stubDb();
    await signupStore(db).dropRequest('user-mia', 'acme');
    expect(calls.slice(1)).toEqual([
      { op: 'delete', args: [] },
      { op: 'eq', args: ['user_id', 'user-mia'] },
      { op: 'eq', args: ['github_org', 'acme'] },
    ]);
  });

  it('throws when a request cannot be read, recorded or dropped', async () => {
    const { db } = stubDb({ error: { message: 'timeout' } });
    await expect(signupStore(db).pendingRequests('u')).rejects.toThrow(/timeout/);
    await expect(signupStore(db).recordRequest('u', 'acme')).rejects.toThrow(/timeout/);
    await expect(signupStore(db).dropRequest('u', 'acme')).rejects.toThrow(/timeout/);
  });
});
