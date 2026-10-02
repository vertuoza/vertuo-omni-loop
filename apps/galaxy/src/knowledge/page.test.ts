import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { KnowledgeView } from './access';

// The knowledge page (app/knowledge/page.tsx), called as the server calls it, with its data sources
// stubbed: crew is membership of a workspace, as in the arcade, never an email domain; the repository
// menu offers the repositories of the crew's own workspaces, read through the App.
const given = vi.hoisted(() => ({
  mode: 'supabase',
  user: null as null | { id: string; email: string },
  member: false,
  down: false,
  graph: { version: 1, repo: 'acme/widgets', domains: [], entries: [], links: [], loose: [], unserved: [] },
  app: true,
}));
const loadKnowledge = vi.hoisted(() => vi.fn(() => given.graph));
const memberGithub = vi.hoisted(() => vi.fn((_db: unknown, _id: string) => Promise.resolve([{ slug: 'acme', github_org: 'acme', github_installation_id: 2 }])));
const reader = vi.hoisted(() => ({
  installationFor: vi.fn((w: { github_installation_id: number | null }) => Promise.resolve(w.github_installation_id)),
  repos: vi.fn((_id: number) => Promise.resolve(['acme/Anvils', 'acme/widgets'])),
  graph: vi.fn((_id: number, repo: string) => Promise.resolve({ version: 1 as const, repo, domains: [], entries: [], links: [], loose: [], unserved: [] })),
}));

vi.mock('server-only', () => ({}));
vi.mock('../data/mode', () => ({ arcadeMode: () => given.mode }));
vi.mock('../data/supabase-server', () => ({
  supabaseEnv: () => (given.mode === 'supabase' ? { url: 'http://127.0.0.1:54321', key: 'anon' } : null),
  supabaseServer: () => Promise.resolve({ auth: { getUser: () => Promise.resolve({ data: { user: given.user } }) } }),
}));
vi.mock('../data/workspace', () => ({
  memberWorkspace: () => {
    if (given.down) return Promise.reject(new Error('Supabase: down'));
    return Promise.resolve(given.member ? { id: 'w1', slug: 'acme', name: 'Acme', theme: {} } : null);
  },
  memberGithub,
}));
vi.mock('../data/load-knowledge', () => ({ loadKnowledge }));
vi.mock('./github-server', () => ({ knowledgeGithub: () => (given.app ? reader : null) }));

const { default: Page } = await import('../../app/knowledge/page.tsx');

const viewOf = async (query: Record<string, string> = {}) =>
  ((await Page({ searchParams: Promise.resolve(query) })) as ReactElement<{ view: KnowledgeView }>).props.view;

beforeEach(() => {
  loadKnowledge.mockClear();
  memberGithub.mockClear();
  reader.graph.mockClear();
  Object.assign(given, { mode: 'supabase', user: null, member: false, down: false, app: true });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); });

describe('the knowledge page', () => {
  it('shows a member of a workspace the map, whatever their email\'s domain', async () => {
    Object.assign(given, { user: { id: 'u1', email: 'ada@acme.example' }, member: true });
    expect(await viewOf()).toMatchObject({ kind: 'map', graph: given.graph });
  });

  it('offers the crew the other repositories of their workspaces, and reads a picked one through its installation', async () => {
    Object.assign(given, { user: { id: 'u1', email: 'ada@acme.example' }, member: true });
    const options = [{ value: '', label: 'acme/widgets' }, { value: 'acme/Anvils', label: 'acme/Anvils' }];
    expect(await viewOf()).toEqual({ kind: 'map', graph: given.graph, menu: { options, current: '' } });
    expect(memberGithub).toHaveBeenCalledWith(expect.anything(), 'u1');
    expect(reader.graph).not.toHaveBeenCalled();

    const view = await viewOf({ repo: 'acme/anvils' });
    expect(view).toMatchObject({ kind: 'map', graph: { repo: 'acme/Anvils' }, menu: { options, current: 'acme/Anvils' } });
    expect(reader.graph).toHaveBeenCalledWith(2, 'acme/Anvils');
  });

  it('offers no menu without the App\'s credentials, and reads no repository from GitHub', async () => {
    Object.assign(given, { user: { id: 'u1', email: 'ada@acme.example' }, member: true, app: false });
    expect(await viewOf({ repo: 'acme/Anvils' })).toEqual({ kind: 'not-offered', repo: 'acme/Anvils', menu: null });
    expect(reader.graph).not.toHaveBeenCalled();
  });

  it('shows an account in no workspace the crew-only notice, and never reads the knowledge', async () => {
    Object.assign(given, { user: { id: 'u1', email: 'eve@vertuoza.com' }, member: false });
    expect(await viewOf()).toEqual({ kind: 'crew-only' });
    expect(loadKnowledge).not.toHaveBeenCalled();
  });

  it('says the knowledge is out of reach when the workspace cannot be read, turning nobody away', async () => {
    Object.assign(given, { user: { id: 'u1', email: 'ada@vertuoza.com' }, down: true });
    expect(await viewOf()).toEqual({ kind: 'out-of-reach', menu: null });
    expect(loadKnowledge).not.toHaveBeenCalled();
  });

  it('shows the sign-in card signed out', async () => {
    expect(await viewOf()).toEqual({ kind: 'sign-in' });
  });

  it('hands the screen the repository the address asked for, so signing in comes back to it', async () => {
    const query = { repo: 'acme/Anvils', domain: 'quote', entry: 'BR-QUOTE-1' };
    const page = (await Page({ searchParams: Promise.resolve(query) })) as ReactElement<{ view: KnowledgeView; wanted: unknown }>;
    expect(page.props.view).toEqual({ kind: 'sign-in' });
    expect(page.props.wanted).toEqual(query);
    expect(memberGithub).not.toHaveBeenCalled();
  });
});
