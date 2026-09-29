import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const read = vi.hoisted(() => ({
  workspace: (async () => ({ id: 'ws-1', slug: 'vertuoza', name: 'Vertuoza', theme: {} })) as () => Promise<unknown>,
}));
vi.mock('../data/workspace', () => ({ memberWorkspace: () => read.workspace() }));

import type { User } from '@supabase/supabase-js';
import type { Installation } from '../signup/installation';
import { loadRepositoriesPage, type RepositoriesApp } from './load';

// Settings → Repositories's read (PRD 612 s1): the workspace's repositories and the caller's role, as
// the signed-in person; the installation and the repositories it can see, as the Omni App (stubbed:
// no test calls GitHub or Supabase).

const USER = { id: 'u-1' } as User;
const INSTALL = 'https://github.com/apps/omni-loop/installations/new';
const VERTUOZA: Installation = { id: 5001, account: { login: 'vertuoza', type: 'Organization' } };
const STORED = [
  { full_name: 'vertuoza/vertuo-apps', tracked: true, collected_at: '2026-10-08T11:57:00Z', collect_error: null },
  { full_name: 'vertuoza/pdf-builder', tracked: false, collected_at: null, collect_error: '404' },
];

type Answer = { data?: unknown; error?: unknown };

function db({ owner = { data: true } as Answer | Error, repositories = { data: STORED } as Answer, workspace = { data: { github_org: 'vertuoza', github_installation_id: 5001 } } as Answer } = {}) {
  const calls: unknown[] = [];
  const query = (answer: Answer) => {
    const q = {
      select: (...a: unknown[]) => { calls.push(['select', ...a]); return q; },
      eq: (...a: unknown[]) => { calls.push(['eq', ...a]); return q; },
      maybeSingle: async () => ({ data: answer.data ?? null, error: answer.error ?? null }),
      then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve({ data: answer.data ?? null, error: answer.error ?? null }).then(ok, ko),
    };
    return q;
  };
  return {
    calls,
    rpc: async (fn: string, args: unknown) => {
      calls.push(['rpc', fn, args]);
      if (owner instanceof Error) throw owner;
      return { data: owner.data ?? null, error: owner.error ?? null };
    },
    from: (table: string) => { calls.push(['from', table]); return query(table === 'repositories' ? repositories : workspace); },
  };
}

function app(over: Partial<RepositoriesApp> = {}): RepositoriesApp & { asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    installation: async (id) => { asked.push(`installation ${id}`); return VERTUOZA; },
    orgInstallation: async (org) => { asked.push(`org ${org}`); return null; },
    userInstallation: async (login) => { asked.push(`user ${login}`); return null; },
    installationRepositories: async (id) => { asked.push(`repositories ${id}`); return ['vertuoza/vertuo-apps', 'vertuoza/new-one']; },
    ...over,
  };
}

describe('the repositories page\'s read', () => {
  beforeEach(() => {
    read.workspace = async () => ({ id: 'ws-1', slug: 'vertuoza', name: 'Vertuoza', theme: {} });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('reads the owner\'s page: the list, the owner flag, the installation\'s settings and what it can see', async () => {
    const d = db();
    const a = app();
    expect(await loadRepositoriesPage(d as never, USER, a, INSTALL)).toEqual({
      kind: 'repositories',
      workspace: { id: 'ws-1', name: 'Vertuoza' },
      owner: true,
      repositories: [
        { fullName: 'vertuoza/vertuo-apps', tracked: true, collectedAt: '2026-10-08T11:57:00Z', collectError: null },
        { fullName: 'vertuoza/pdf-builder', tracked: false, collectedAt: null, collectError: '404' },
      ],
      access: {
        kind: 'installed',
        settingsUrl: 'https://github.com/organizations/vertuoza/settings/installations/5001',
        reachable: ['vertuoza/vertuo-apps', 'vertuoza/new-one'],
      },
    });
    expect(d.calls).toContainEqual(['rpc', 'is_owner', { workspace: 'ws-1' }]);
    expect(d.calls).toContainEqual(['eq', 'workspace_id', 'ws-1']);
    expect(a.asked).toEqual(['installation 5001', 'repositories 5001']);
  });

  it('reads a member, or anyone whose role cannot be read, as no owner', async () => {
    expect(await loadRepositoriesPage(db({ owner: { data: false } }) as never, USER, app(), INSTALL)).toMatchObject({ owner: false });
    expect(await loadRepositoriesPage(db({ owner: new Error('down') }) as never, USER, app(), INSTALL)).toMatchObject({ owner: false });
  });

  it('finds the App\'s installation on the workspace\'s GitHub org when none is stored', async () => {
    const a = app({ orgInstallation: async () => VERTUOZA });
    const load = await loadRepositoriesPage(db({ workspace: { data: { github_org: 'vertuoza', github_installation_id: null } } }) as never, USER, a, INSTALL);
    expect(load).toMatchObject({ access: { kind: 'installed', reachable: ['vertuoza/vertuo-apps', 'vertuoza/new-one'] } });
  });

  it('reads a workspace with no installation as such, with the install link', async () => {
    const load = await loadRepositoriesPage(db({ workspace: { data: { github_org: 'acme', github_installation_id: null } } }) as never, USER, app(), INSTALL);
    expect(load).toMatchObject({ kind: 'repositories', access: { kind: 'none', installUrl: INSTALL } });
    const none = await loadRepositoriesPage(db({ workspace: { data: { github_org: null, github_installation_id: null } } }) as never, USER, null, INSTALL);
    expect(none).toMatchObject({ access: { kind: 'none', installUrl: INSTALL } });
  });

  it('keeps the list when the App\'s listing cannot be read, with nothing to offer', async () => {
    const a = app({ installationRepositories: async () => { throw new Error('GitHub answered 500'); } });
    expect(await loadRepositoriesPage(db() as never, USER, a, INSTALL)).toMatchObject({
      kind: 'repositories', access: { kind: 'installed', settingsUrl: 'https://github.com/organizations/vertuoza/settings/installations/5001', reachable: null },
    });
  });

  it('keeps the list when the App cannot be asked at all', async () => {
    expect(await loadRepositoriesPage(db() as never, USER, null, INSTALL)).toMatchObject({ access: { kind: 'installed', settingsUrl: null, reachable: null } });
    const failing = app({ installation: async () => { throw new Error('GitHub answered 502'); } });
    expect(await loadRepositoriesPage(db() as never, USER, failing, INSTALL)).toMatchObject({ access: { kind: 'installed', settingsUrl: null, reachable: null } });
  });

  it('answers no-workspace for an account in none, and unreadable when the list cannot be read', async () => {
    read.workspace = async () => null;
    expect(await loadRepositoriesPage(db() as never, USER, app(), INSTALL)).toEqual({ kind: 'no-workspace' });
    read.workspace = async () => ({ id: 'ws-1', slug: 'vertuoza', name: 'Vertuoza', theme: {} });
    expect(await loadRepositoriesPage(db({ repositories: { error: { message: 'down' } } }) as never, USER, app(), INSTALL)).toEqual({ kind: 'unreadable' });
  });
});
