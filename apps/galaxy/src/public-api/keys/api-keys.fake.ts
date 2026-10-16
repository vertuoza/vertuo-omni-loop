import type { ApiKey } from './api-keys.contract';
import type { ApiKeysRepository, Written } from './api-keys.repository';

// The API keys' database in memory (PRD 2022 s1), for the service's and the controller's tests: the
// rules of supabase/migrations/20261210090000_api_keys.sql, answered with its codes and hints, as each
// person reads it. Two workspaces: Northwind (Ada owns it, Ben is a member) and Southwind (Dan owns it).

export const NORTHWIND = '11111111-1111-4111-8111-111111111111';
export const SOUTHWIND = '22222222-2222-4222-8222-222222222222';
export const ADA = 'ada';
export const BEN = 'ben';
export const DAN = 'dan';

type Stored = { key: ApiKey; workspace: string; hash: string };

const refused = (code: string, message: string, hint: string | null = null) => ({ ok: false as const, code, hint, message });

export function fakeApiKeysDb(now = () => '2026-10-15T10:00:00.000Z') {
  const roles = new Map<string, Map<string, 'owner' | 'member'>>([
    [NORTHWIND, new Map([[ADA, 'owner'], [BEN, 'member']])],
    [SOUTHWIND, new Map([[DAN, 'owner']])],
  ]);
  const tracked = new Map<string, string[]>([
    [NORTHWIND, ['northwind/backend', 'northwind/web']],
    [SOUTHWIND, ['southwind/backend']],
  ]);
  const keys: Stored[] = [];
  let next = 0;
  const listed = (stored: Stored): ApiKey => stored.key;
  const live = (workspace: string) => keys.filter((k) => k.workspace === workspace && k.key.revokedAt === null);

  const as = (person: string): ApiKeysRepository => {
    const role = (workspace: string) => roles.get(workspace)?.get(person) ?? null;
    return {
      list(workspace) {
        if (!role(workspace)) return Promise.reject(new Error('Supabase: could not read the API keys (Only a member of the workspace can see its API keys.)'));
        return Promise.resolve(live(workspace).map(listed).reverse());
      },
      make(workspace, name, repos, hash, lastFour): Promise<Written<string>> {
        if (role(workspace) !== 'owner') return Promise.resolve(refused('42501', 'Only an owner of the workspace makes or revokes its API keys.'));
        if (repos.some((r) => !(tracked.get(workspace) ?? []).includes(r))) return Promise.resolve(refused('22023', 'Repositories: not tracked.', 'repos'));
        if (live(workspace).some((k) => k.key.name.toLowerCase() === name.toLowerCase())) {
          return Promise.resolve(refused('22023', `Name: this workspace already has a key named ${name}.`, 'name'));
        }
        if (live(workspace).length >= 20) return Promise.resolve(refused('54000', 'This workspace holds 20 API keys already.', 'limit'));
        next += 1;
        const id = `00000000-0000-4000-8000-${String(next).padStart(12, '0')}`;
        keys.push({
          workspace, hash,
          key: { id, name, lastFour, repos: [...repos].sort(), createdAt: now(), lastUsedAt: null, revokedAt: null, maker: { id: person, login: person, name: null }, working: true },
        });
        return Promise.resolve({ ok: true, value: id });
      },
      revoke(workspace, id): Promise<Written<ApiKey>> {
        if (role(workspace) !== 'owner') return Promise.resolve(refused('42501', 'Only an owner of the workspace makes or revokes its API keys.'));
        const key = keys.find((k) => k.key.id === id && k.workspace === workspace);
        if (!key) return Promise.resolve(refused('P0002', 'Key: this workspace holds no such API key.', 'key'));
        key.key.revokedAt ??= now();
        return Promise.resolve({ ok: true, value: listed(key) });
      },
      owner: (workspace) => Promise.resolve(role(workspace) === 'owner'),
      tracked: (workspace) => Promise.resolve(tracked.get(workspace) ?? []),
    };
  };
  return { as, keys };
}
