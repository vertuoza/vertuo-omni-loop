import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const read = vi.hoisted(() => ({
  workspace: (): Promise<unknown> => Promise.resolve({ id: 'ws-1', slug: 'acme', name: 'Acme', theme: {} }),
  fleets: (): Promise<unknown> => Promise.resolve([]),
}));
vi.mock('../data/workspace', () => ({ memberWorkspace: () => read.workspace() }));
vi.mock('../data/load-galaxy', () => ({ loadFleets: () => read.fleets() }));

import type { User } from '@supabase/supabase-js';
import { loadFleetsPage } from './load';
import { MASCOTS } from './store';

// /app/settings/fleets's read (PRD 400 s3), as the signed-in person: their workspace (the one joined first, as
// /app's), its fleets, retired ones included, whether they own it (is_owner(), s1) and the mascots an
// owner may pick (fleet_mascots(), s1).

const USER = { id: 'u-1' } as User;
const BEAVER = { name: 'beaver', home: null, label: 'BEAVER', color: '#d08a4a', motto: '', mascot: 'beaver', sort: 10, retired: false };

function db(answers: Record<string, { data?: unknown; error?: unknown } | Error>) {
  const calls: [string, unknown][] = [];
  return {
    calls,
    rpc: (fn: string, args: unknown) => {
      calls.push([fn, args]);
      const a = answers[fn];
      if (a instanceof Error) return Promise.reject(a);
      return Promise.resolve({ data: a?.data ?? null, error: a?.error ?? null });
    },
  };
}

describe('the fleets page\'s read', () => {
  beforeEach(() => {
    read.workspace = () => Promise.resolve({ id: 'ws-1', slug: 'acme', name: 'Acme', theme: {} });
    read.fleets = () => Promise.resolve([BEAVER]);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('reads the owner\'s page: the workspace, its fleets, the owner flag and the mascots', async () => {
    const d = db({ is_owner: { data: true }, fleet_mascots: { data: ['beaver', 'cia'] } });
    expect(await loadFleetsPage(d as never, USER)).toEqual({
      kind: 'fleets', workspace: { id: 'ws-1', name: 'Acme' }, owner: true, fleets: [BEAVER], mascots: ['beaver', 'cia'],
    });
    expect(d.calls).toContainEqual(['is_owner', { workspace: 'ws-1' }]);
  });

  it('reads a member as no owner', async () => {
    expect(await loadFleetsPage(db({ is_owner: { data: false } }) as never, USER)).toMatchObject({ kind: 'fleets', owner: false });
  });

  it('reads anyone whose role cannot be read as a member: the page then only shows', async () => {
    expect(await loadFleetsPage(db({ is_owner: { error: { message: 'down' } } }) as never, USER)).toMatchObject({ owner: false });
    expect(await loadFleetsPage(db({ is_owner: new Error('fetch failed') }) as never, USER)).toMatchObject({ owner: false });
  });

  it('falls back to the known mascots when fleet_mascots() cannot be read', async () => {
    expect(await loadFleetsPage(db({ is_owner: { data: true }, fleet_mascots: { error: { message: 'down' } } }) as never, USER))
      .toMatchObject({ mascots: MASCOTS });
  });

  it('is the no-workspace notice for an account in none', async () => {
    read.workspace = () => Promise.resolve(null);
    expect(await loadFleetsPage(db({}) as never, USER)).toEqual({ kind: 'no-workspace' });
  });

  it('is unreadable when the workspace or its fleets cannot be read', async () => {
    read.workspace = () => Promise.reject(new Error('down'));
    expect(await loadFleetsPage(db({}) as never, USER)).toEqual({ kind: 'unreadable' });
    read.workspace = () => Promise.resolve({ id: 'ws-1', slug: 'acme', name: 'Acme', theme: {} });
    read.fleets = () => Promise.reject(new Error('down'));
    expect(await loadFleetsPage(db({ is_owner: { data: true } }) as never, USER)).toEqual({ kind: 'unreadable' });
  });
});
