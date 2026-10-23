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
  it('lists the live keys through api_keys_list(), each with the App api_key_github_apps_list() gives it, or null', async () => {
    const other = { ...KEY, id: 'k-2', name: 'Weekly digest' };
    const { db, calls } = recording({
      api_keys_list: { data: [KEY, other], error: null },
      api_key_github_apps_list: { data: [{ keyId: 'k-2', slug: 'acme-bugs' }], error: null },
    });
    expect(await apiKeysRepository(db).list('ws-1')).toEqual([{ ...KEY, githubApp: null }, { ...other, githubApp: { slug: 'acme-bugs' } }]);
    expect(calls).toEqual([['rpc', 'api_keys_list', { p_workspace: 'ws-1' }], ['rpc', 'api_key_github_apps_list', { p_workspace: 'ws-1' }]]);
  });

  it('gives an App its last token only when the database sent one: an owner’s read, none until it first mints', async () => {
    const apps = (rows: unknown[]) => recording({ api_keys_list: { data: [KEY, { ...KEY, id: 'k-2' }], error: null }, api_key_github_apps_list: { data: rows, error: null } }).db;
    const read = await apiKeysRepository(apps([
      { keyId: 'k-1', slug: 'acme-bugs', lastTokenAt: '2026-10-22T09:00:00+00:00' }, { keyId: 'k-2', slug: 'acme-docs', lastTokenAt: null },
    ])).list('ws-1');
    expect(read.map((k) => k.githubApp)).toEqual([{ slug: 'acme-bugs', lastTokenAt: '2026-10-22T09:00:00+00:00' }, { slug: 'acme-docs', lastTokenAt: null }]);
    const member = await apiKeysRepository(apps([{ keyId: 'k-1', slug: 'acme-bugs' }])).list('ws-1');
    expect(member[0]?.githubApp).toEqual({ slug: 'acme-bugs' });
    expect(JSON.stringify(member)).not.toContain('lastTokenAt');
  });

  it('throws when a list is refused, or out of shape', async () => {
    const apps = { api_key_github_apps_list: { data: [], error: null } };
    await expect(apiKeysRepository(recording({ ...apps, api_keys_list: { data: null, error: { message: 'denied' } } }).db).list('ws-1')).rejects.toThrow(/denied/);
    await expect(apiKeysRepository(recording({ ...apps, api_keys_list: { data: [{ name: 'x' }], error: null } }).db).list('ws-1')).rejects.toThrow();
    const keys = { api_keys_list: { data: [KEY], error: null } };
    await expect(apiKeysRepository(recording({ ...keys, api_key_github_apps_list: { data: null, error: { message: 'nope' } } }).db).list('ws-1')).rejects.toThrow(/nope/);
    await expect(apiKeysRepository(recording({ ...keys, api_key_github_apps_list: { data: [{ slug: 'x' }], error: null } }).db).list('ws-1')).rejects.toThrow();
  });

  it('drops anything the contract does not name, a hash and a sealed key included', async () => {
    const { db } = recording({
      api_keys_list: { data: [{ ...KEY, tokenHash: 'f'.repeat(64) }], error: null },
      api_key_github_apps_list: { data: [{ keyId: 'k-1', slug: 'acme-bugs', ciphertext: 'sealed', iv: 'iv', appId: 1 }], error: null },
    });
    const [listed] = await apiKeysRepository(db).list('ws-1');
    expect(listed).toEqual({ ...KEY, githubApp: { slug: 'acme-bugs' } });
  });

  it('attaches an App through api_key_github_app_attach(), with the sealed key only, and answers its slug', async () => {
    const { db, calls } = recording({ api_key_github_app_attach: { data: { keyId: 'k-1', slug: 'acme-bugs', lastTokenAt: null }, error: null } });
    expect(await apiKeysRepository(db).attachGithubApp('k-1', 123456, 'acme-bugs', 777, { ciphertext: 'c2VhbGVk', iv: 'aXY=' }))
      .toEqual({ ok: true, value: { slug: 'acme-bugs' } });
    expect(calls).toEqual([['rpc', 'api_key_github_app_attach', { p_key: 'k-1', p_app_id: 123456, p_slug: 'acme-bugs', p_bot_id: 777, p_ciphertext: 'c2VhbGVk', p_iv: 'aXY=' }]]);
  });

  it('keeps an attach refusal’s code, hint and words, and throws on an answer out of shape', async () => {
    const refusal = recording({ api_key_github_app_attach: { data: null, error: { code: '42501', hint: 'key', message: 'Key: this API key is revoked.' } } });
    expect(await apiKeysRepository(refusal.db).attachGithubApp('k-1', 1, 'a', 2, { ciphertext: 'c', iv: 'i' }))
      .toEqual({ ok: false, code: '42501', hint: 'key', message: 'Key: this API key is revoked.' });
    const odd = recording({ api_key_github_app_attach: { data: { nope: 1 }, error: null } });
    await expect(apiKeysRepository(odd.db).attachGithubApp('k-1', 1, 'a', 2, { ciphertext: 'c', iv: 'i' })).rejects.toThrow();
  });

  it('removes an App through api_key_github_app_remove(), answering whether the key held one', async () => {
    const { db, calls } = recording({ api_key_github_app_remove: { data: true, error: null } });
    expect(await apiKeysRepository(db).removeGithubApp('k-1')).toEqual({ ok: true, value: true });
    expect(calls).toEqual([['rpc', 'api_key_github_app_remove', { p_key: 'k-1' }]]);
    const refused = recording({ api_key_github_app_remove: { data: null, error: { code: '42501', message: 'Only an owner.' } } });
    expect(await apiKeysRepository(refused.db).removeGithubApp('k-1')).toEqual({ ok: false, code: '42501', hint: null, message: 'Only an owner.' });
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
