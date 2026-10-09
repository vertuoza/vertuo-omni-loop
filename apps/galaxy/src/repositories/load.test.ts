import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const read = vi.hoisted((): { workspace: () => Promise<unknown> } => ({
  workspace: () => Promise.resolve({ id: 'ws-1', slug: 'vertuoza', name: 'Vertuoza', theme: {} }),
}));
vi.mock('../data/workspace', () => ({ memberWorkspace: () => read.workspace() }));

import type { User } from '@supabase/supabase-js';
import { githubClient, memoryGithubStore, type GithubClient, type GithubStore } from '@omni/github';
import type { Installation } from '../signup/installation';
import { loadRepositoriesPage, type RepositoriesApp } from './load';

// Settings → Repositories's read (PRD 612 s1): the workspace's repositories and the caller's role, as
// the signed-in person; the installation and the repositories it can see, as the Omni App (stubbed:
// no test calls GitHub or Supabase).

const USER = { id: 'u-1' } as User;
const INSTALL = 'https://github.com/apps/omni-loop/installations/new';
const VERTUOZA: Installation = { id: 5001, account: { login: 'vertuoza', type: 'Organization' } };
const NOW = Date.parse('2026-10-05T10:00:00Z');
const STORED = [
  { full_name: 'vertuoza/vertuo-apps', tracked: true, collected_at: '2026-10-08T11:57:00Z', collect_error: null },
  { full_name: 'vertuoza/pdf-builder', tracked: false, collected_at: null, collect_error: '404' },
];

type Answer = { data?: unknown; error?: unknown };

function db({
  owner = { data: true },
  repositories = { data: STORED },
  workspace = { data: { github_org: 'vertuoza', github_installation_id: 5001 } },
  products = { data: [{ id: 'p-1', name: 'Vertuoza' }] },
}: { owner?: Answer | Error; repositories?: Answer; workspace?: Answer; products?: Answer } = {}) {
  const calls: unknown[] = [];
  const query = (answer: Answer) => {
    const q = {
      select: (...a: unknown[]) => { calls.push(['select', ...a]); return q; },
      eq: (...a: unknown[]) => { calls.push(['eq', ...a]); return q; },
      order: (...a: unknown[]) => { calls.push(['order', ...a]); return q; },
      maybeSingle: () => Promise.resolve({ data: answer.data ?? null, error: answer.error ?? null }),
      then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve({ data: answer.data ?? null, error: answer.error ?? null }).then(ok, ko),
    };
    return q;
  };
  return {
    calls,
    rpc: (fn: string, args: unknown) => {
      calls.push(['rpc', fn, args]);
      if (owner instanceof Error) return Promise.reject(owner);
      return Promise.resolve({ data: owner.data ?? null, error: owner.error ?? null });
    },
    from: (table: string) => {
      calls.push(['from', table]);
      return query(table === 'repositories' ? repositories : table === 'products' ? products : workspace);
    },
  };
}

function app(over: Partial<RepositoriesApp> = {}): RepositoriesApp & { asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    installation: (id) => { asked.push(`installation ${id}`); return Promise.resolve(VERTUOZA); },
    orgInstallation: (org) => { asked.push(`org ${org}`); return Promise.resolve(null); },
    userInstallation: (login) => { asked.push(`user ${login}`); return Promise.resolve(null); },
    installationToken: (id) => { asked.push(`token ${id}`); return Promise.resolve({ token: 'ghs_1' }); },
    ...over,
  };
}

/** The installation's repositories as GitHub answers them, through the shared client. */
function github({ status = 200, store = null }: { status?: number; store?: GithubStore | null } = {}): GithubClient & { sent: { url: string; headers: Headers }[] } {
  const sent: { url: string; headers: Headers }[] = [];
  const client = githubClient({
    store,
    clock: () => NOW,
    log: () => {},
    fetch: (url, init) => {
      sent.push({ url, headers: new Headers(init.headers) });
      const body = status === 200 ? { total_count: 2, repositories: [{ full_name: 'vertuoza/vertuo-apps' }, { full_name: 'vertuoza/new-one' }] } : { message: 'boom' };
      return Promise.resolve(new Response(JSON.stringify(body), { status }));
    },
  });
  return { ...client, sent };
}

describe('the repositories page\'s read', () => {
  beforeEach(() => {
    read.workspace = () => Promise.resolve({ id: 'ws-1', slug: 'vertuoza', name: 'Vertuoza', theme: {} });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('reads the owner\'s page: the list, the owner flag, the installation\'s settings and what it can see', async () => {
    const d = db();
    const a = app();
    const gh = github();
    expect(await loadRepositoriesPage(d as never, USER, a, INSTALL, gh)).toEqual({
      kind: 'repositories',
      workspace: { id: 'ws-1', name: 'Vertuoza' },
      owner: true,
      repositories: [
        { fullName: 'vertuoza/vertuo-apps', tracked: true, collectedAt: '2026-10-08T11:57:00Z', collectError: null, product: null, publicIdeas: false, phase0: 'pr' },
        { fullName: 'vertuoza/pdf-builder', tracked: false, collectedAt: null, collectError: '404', product: null, publicIdeas: false, phase0: 'pr' },
      ],
      products: [{ id: 'p-1', name: 'Vertuoza' }],
      access: {
        kind: 'installed',
        settingsUrl: 'https://github.com/organizations/vertuoza/settings/installations/5001',
        reachable: ['vertuoza/vertuo-apps', 'vertuoza/new-one'],
      },
    });
    expect(d.calls).toContainEqual(['rpc', 'is_owner', { workspace: 'ws-1' }]);
    expect(d.calls).toContainEqual(['eq', 'workspace_id', 'ws-1']);
    expect(a.asked).toEqual(['installation 5001', 'token 5001']);
    expect(gh.sent.map((c) => [c.url, c.headers.get('authorization')])).toEqual([['https://api.github.com/installation/repositories?per_page=100&page=1', 'Bearer ghs_1']]);
  });

  it('reads whether each repository\'s ideas board is public (PRD 1246 s4)', async () => {
    const d = db({ repositories: { data: [{ ...STORED[0], public_ideas: true }] } });
    expect(await loadRepositoriesPage(d as never, USER, app(), INSTALL, github())).toMatchObject({
      repositories: [{ fullName: 'vertuoza/vertuo-apps', publicIdeas: true }],
    });
    expect(d.calls).toContainEqual(['select', expect.stringContaining('public_ideas')]);
  });

  it('reads where each repository\'s phase 0 is approved (PRD 1299 s1)', async () => {
    const d = db({ repositories: { data: [{ ...STORED[0], phase0: 'server' }] } });
    expect(await loadRepositoriesPage(d as never, USER, app(), INSTALL, github())).toMatchObject({
      repositories: [{ fullName: 'vertuoza/vertuo-apps', phase0: 'server' }],
    });
    expect(d.calls).toContainEqual(['select', expect.stringContaining('phase0')]);
  });

  it('reads the business\'s products, first first, and each repository\'s (PRD 748 s4)', async () => {
    const d = db({
      repositories: { data: [{ ...STORED[0], product_id: 'p-2' }] },
      products: { data: [{ id: 'p-1', name: 'Vertuoza' }, { id: 'p-2', name: 'Omni Loop' }] },
    });
    expect(await loadRepositoriesPage(d as never, USER, app(), INSTALL, github())).toMatchObject({
      repositories: [{ fullName: 'vertuoza/vertuo-apps', product: 'p-2' }],
      products: [{ id: 'p-1', name: 'Vertuoza' }, { id: 'p-2', name: 'Omni Loop' }],
    });
    expect(d.calls).toContainEqual(['from', 'products']);
    expect(d.calls).toContainEqual(['order', 'ordinal']);
  });

  it('keeps the list, with no product, when the products cannot be read', async () => {
    expect(await loadRepositoriesPage(db({ products: { error: { message: 'down' } } }) as never, USER, app(), INSTALL, github()))
      .toMatchObject({ kind: 'repositories', products: [], repositories: [{ fullName: 'vertuoza/vertuo-apps' }, { fullName: 'vertuoza/pdf-builder' }] });
  });

  it('reads a member, or anyone whose role cannot be read, as no owner', async () => {
    expect(await loadRepositoriesPage(db({ owner: { data: false } }) as never, USER, app(), INSTALL, github())).toMatchObject({ owner: false });
    expect(await loadRepositoriesPage(db({ owner: new Error('down') }) as never, USER, app(), INSTALL, github())).toMatchObject({ owner: false });
  });

  it('finds the App\'s installation on the workspace\'s GitHub org when none is stored', async () => {
    const a = app({ orgInstallation: () => Promise.resolve(VERTUOZA) });
    const load = await loadRepositoriesPage(db({ workspace: { data: { github_org: 'vertuoza', github_installation_id: null } } }) as never, USER, a, INSTALL, github());
    expect(load).toMatchObject({ access: { kind: 'installed', reachable: ['vertuoza/vertuo-apps', 'vertuoza/new-one'] } });
  });

  it('reads a workspace with no installation as such, with the install link', async () => {
    const load = await loadRepositoriesPage(db({ workspace: { data: { github_org: 'acme', github_installation_id: null } } }) as never, USER, app(), INSTALL, github());
    expect(load).toMatchObject({ kind: 'repositories', access: { kind: 'none', installUrl: INSTALL } });
    const none = await loadRepositoriesPage(db({ workspace: { data: { github_org: null, github_installation_id: null } } }) as never, USER, null, INSTALL, github());
    expect(none).toMatchObject({ access: { kind: 'none', installUrl: INSTALL } });
  });

  it('keeps the list when the App\'s listing cannot be read, with nothing to offer', async () => {
    expect(await loadRepositoriesPage(db() as never, USER, app(), INSTALL, github({ status: 500 }))).toMatchObject({
      kind: 'repositories', access: { kind: 'installed', settingsUrl: 'https://github.com/organizations/vertuoza/settings/installations/5001', reachable: null },
    });
  });

  it('reads what the installation can see through the shared budget, as a person waits on it (PRD 902, s6)', async () => {
    const low = memoryGithubStore();
    await low.saveBudget(5001, 'core', { limit: 5000, remaining: 10, resetAt: NOW + 60_000, at: NOW });
    expect(await loadRepositoriesPage(db() as never, USER, app(), INSTALL, github({ store: low }))).toMatchObject({
      access: { reachable: ['vertuoza/vertuo-apps', 'vertuoza/new-one'] },
    });

    const paused = memoryGithubStore();
    await paused.pause(5001, 'core', NOW + 60_000, NOW);
    const gh = github({ store: paused });
    expect(await loadRepositoriesPage(db() as never, USER, app(), INSTALL, gh)).toMatchObject({
      access: { kind: 'installed', settingsUrl: 'https://github.com/organizations/vertuoza/settings/installations/5001', reachable: null },
    });
    expect(gh.sent).toEqual([]);
  });

  it('keeps the list when the App cannot be asked at all', async () => {
    expect(await loadRepositoriesPage(db() as never, USER, null, INSTALL, github())).toMatchObject({ access: { kind: 'installed', settingsUrl: null, reachable: null } });
    const failing = app({ installation: () => Promise.reject(new Error('GitHub answered 502')) });
    expect(await loadRepositoriesPage(db() as never, USER, failing, INSTALL, github())).toMatchObject({ access: { kind: 'installed', settingsUrl: null, reachable: null } });
  });

  it('answers no-workspace for an account in none, and unreadable when the list cannot be read', async () => {
    read.workspace = () => Promise.resolve(null);
    expect(await loadRepositoriesPage(db() as never, USER, app(), INSTALL, github())).toEqual({ kind: 'no-workspace' });
    read.workspace = () => Promise.resolve({ id: 'ws-1', slug: 'vertuoza', name: 'Vertuoza', theme: {} });
    expect(await loadRepositoriesPage(db({ repositories: { error: { message: 'down' } } }) as never, USER, app(), INSTALL, github())).toEqual({ kind: 'unreadable' });
  });
});
