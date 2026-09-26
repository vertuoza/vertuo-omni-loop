import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { KnowledgeView } from './access';

// The knowledge page (app/knowledge/page.tsx), called as the server calls it, with its data sources
// stubbed: crew is membership of a workspace, as in the arcade, never an email domain.
const given = vi.hoisted(() => ({
  mode: 'supabase' as 'demo' | 'closed' | 'supabase',
  user: null as null | { id: string; email: string },
  member: false,
  down: false,
  graph: { version: 1, repo: 'acme/widgets', domains: [], entries: [], links: [], loose: [], unserved: [] },
}));
const loadKnowledge = vi.hoisted(() => vi.fn(() => given.graph));

vi.mock('server-only', () => ({}));
vi.mock('../data/mode', () => ({ arcadeMode: () => given.mode }));
vi.mock('../data/supabase-server', () => ({
  supabaseEnv: () => (given.mode === 'supabase' ? { url: 'http://127.0.0.1:54321', key: 'anon' } : null),
  supabaseServer: async () => ({ auth: { getUser: async () => ({ data: { user: given.user } }) } }),
}));
vi.mock('../data/workspace', () => ({
  memberWorkspace: async () => {
    if (given.down) throw new Error('Supabase: down');
    return given.member ? { id: 'w1', slug: 'acme', name: 'Acme', theme: {} } : null;
  },
}));
vi.mock('../data/load-knowledge', () => ({ loadKnowledge }));

const { default: Page } = await import('../../app/knowledge/page.tsx');

const viewOf = async () =>
  ((await Page({ searchParams: Promise.resolve({}) })) as ReactElement<{ view: KnowledgeView }>).props.view;

beforeEach(() => {
  loadKnowledge.mockClear();
  Object.assign(given, { mode: 'supabase', user: null, member: false, down: false });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); });

describe('the knowledge page', () => {
  it('shows a member of a workspace the map, whatever their email\'s domain', async () => {
    Object.assign(given, { user: { id: 'u1', email: 'ada@acme.example' }, member: true });
    expect(await viewOf()).toEqual({ kind: 'map', graph: given.graph });
  });

  it('shows an account in no workspace the crew-only notice, and never reads the knowledge', async () => {
    Object.assign(given, { user: { id: 'u1', email: 'eve@vertuoza.com' }, member: false });
    expect(await viewOf()).toEqual({ kind: 'crew-only' });
    expect(loadKnowledge).not.toHaveBeenCalled();
  });

  it('says the knowledge is out of reach when the workspace cannot be read, turning nobody away', async () => {
    Object.assign(given, { user: { id: 'u1', email: 'ada@vertuoza.com' }, down: true });
    expect(await viewOf()).toEqual({ kind: 'out-of-reach' });
    expect(loadKnowledge).not.toHaveBeenCalled();
  });

  it('shows the sign-in card signed out', async () => {
    expect(await viewOf()).toEqual({ kind: 'sign-in' });
  });
});
