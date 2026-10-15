import { describe, expect, it } from 'vitest';
import { apiKeysRepository, type ApiKeysDb } from './api-keys.repository';

// The API keys' reads and writes (PRD 2022 s1) on a recording client: the functions of the migration,
// called by name with their arguments, each answer parsed where it comes in, a refusal kept with its
// code and hint.

const KEY = {
  id: 'k-1', name: 'QA dashboard', lastFour: '9fQe', repos: ['northwind/backend'], createdAt: '2026-10-15T10:00:00+00:00',
  lastUsedAt: null, revokedAt: null, maker: { id: 'u-1', login: 'ada', name: 'Ada' }, working: true,
};

type Answer = { data: unknown; error: { code?: string; hint?: string; message: string } | null };

function recording(answers: Record<string, Answer>) {
  const calls: unknown[] = [];
  const chain = (table: string, steps: unknown[]): unknown => ({
    select: (cols: string) => chain(table, [...steps, ['select', cols]]),
    eq: (col: string, value: unknown) => chain(table, [...steps, ['eq', col, value]]),
    order: (col: string) => {
      calls.push(['from', table, ...steps, ['order', col]]);
      return Promise.resolve(answers[`from:${table}`]);
    },
  });
  const db = {
    rpc: (fn: string, args: unknown) => {
      calls.push(['rpc', fn, args]);
      return Promise.resolve(answers[fn]);
    },
    from: (table: string) => chain(table, []),
  } as unknown as ApiKeysDb;
  return { db, calls };
}

describe('the API keys’ repository', () => {
  it('lists the live keys through api_keys_list()', async () => {
    const { db, calls } = recording({ api_keys_list: { data: [KEY], error: null } });
    expect(await apiKeysRepository(db).list('ws-1')).toEqual([KEY]);
    expect(calls).toEqual([['rpc', 'api_keys_list', { p_workspace: 'ws-1' }]]);
  });

  it('throws when the list is refused, or out of shape', async () => {
    await expect(apiKeysRepository(recording({ api_keys_list: { data: null, error: { message: 'denied' } } }).db).list('ws-1')).rejects.toThrow(/denied/);
    await expect(apiKeysRepository(recording({ api_keys_list: { data: [{ name: 'x' }], error: null } }).db).list('ws-1')).rejects.toThrow();
  });

  it('drops anything the contract does not name, a hash included', async () => {
    const { db } = recording({ api_keys_list: { data: [{ ...KEY, tokenHash: 'f'.repeat(64) }], error: null } });
    expect(await apiKeysRepository(db).list('ws-1')).toEqual([KEY]);
  });

  it('makes a key with its hash and last four, never a secret, and answers its id', async () => {
    const { db, calls } = recording({ api_key_make: { data: 'k-2', error: null } });
    expect(await apiKeysRepository(db).make('ws-1', 'QA', ['northwind/backend'], 'f'.repeat(64), 'abcd')).toEqual({ ok: true, value: 'k-2' });
    expect(calls).toEqual([['rpc', 'api_key_make', { p_workspace: 'ws-1', p_name: 'QA', p_repos: ['northwind/backend'], p_hash: 'f'.repeat(64), p_last_four: 'abcd' }]]);
  });

  it('keeps a refusal’s code, hint and words', async () => {
    const { db } = recording({ api_key_make: { data: null, error: { code: '22023', hint: 'repos', message: 'Repositories: x is not tracked.' } } });
    expect(await apiKeysRepository(db).make('ws-1', 'QA', ['x/y'], 'f'.repeat(64), 'abcd'))
      .toEqual({ ok: false, code: '22023', hint: 'repos', message: 'Repositories: x is not tracked.' });
    const bare = recording({ api_key_revoke: { data: null, error: { message: 'gone' } } });
    expect(await apiKeysRepository(bare.db).revoke('ws-1', 'k-1')).toEqual({ ok: false, code: null, hint: null, message: 'gone' });
  });

  it('revokes a key through api_key_revoke(), answering it as listed', async () => {
    const revoked = { ...KEY, revokedAt: '2026-10-15T11:00:00+00:00' };
    const { db, calls } = recording({ api_key_revoke: { data: revoked, error: null } });
    expect(await apiKeysRepository(db).revoke('ws-1', 'k-1')).toEqual({ ok: true, value: revoked });
    expect(calls).toEqual([['rpc', 'api_key_revoke', { p_workspace: 'ws-1', p_key: 'k-1' }]]);
  });

  it('reads whether the caller owns the workspace', async () => {
    const { db, calls } = recording({ is_owner: { data: true, error: null } });
    expect(await apiKeysRepository(db).owner('ws-1')).toBe(true);
    expect(calls).toEqual([['rpc', 'is_owner', { workspace: 'ws-1' }]]);
    await expect(apiKeysRepository(recording({ is_owner: { data: null, error: { message: 'no' } } }).db).owner('ws-1')).rejects.toThrow(/your role/);
  });

  it('reads the repositories the workspace tracks, by name', async () => {
    const { db, calls } = recording({ 'from:repositories': { data: [{ full_name: 'northwind/backend' }, { full_name: 'northwind/web' }], error: null } });
    expect(await apiKeysRepository(db).tracked('ws-1')).toEqual(['northwind/backend', 'northwind/web']);
    expect(calls).toEqual([['from', 'repositories', ['select', 'full_name'], ['eq', 'workspace_id', 'ws-1'], ['eq', 'tracked', true], ['order', 'full_name']]]);
    await expect(apiKeysRepository(recording({ 'from:repositories': { data: null, error: { message: 'no' } } }).db).tracked('ws-1')).rejects.toThrow(/repositories/);
  });
});
