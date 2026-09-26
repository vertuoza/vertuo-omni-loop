import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The arcade page (app/page.tsx), called as the server calls it, with its data sources stubbed: which
// visitor's page carries the star chart's knowledge. The props it returns are what reaches the browser.
const given = vi.hoisted(() => ({
  mode: 'demo' as 'demo' | 'closed' | 'supabase',
  user: null as null | { id: string; email: string; user_metadata: Record<string, string>; identities: [] },
  galaxyDown: false,
  graph: { version: 1, repo: 'acme/widgets', domains: [], entries: [], links: [], loose: [], unserved: [] },
  view: { planets: [], sectors: [], teams: [] },
}));
const loadKnowledge = vi.hoisted(() => vi.fn(() => given.graph));

vi.mock('server-only', () => ({}));
vi.mock('../data/mode', () => ({ arcadeMode: () => given.mode }));
vi.mock('../data/supabase-server', () => ({
  supabaseEnv: () => (given.mode === 'supabase' ? { url: 'http://127.0.0.1:54321', key: 'anon' } : null),
  supabaseServer: async () => ({ auth: { getUser: async () => ({ data: { user: given.user } }) } }),
  isCrewEmail: (email?: string | null) => Boolean(email?.endsWith('@vertuoza.com')),
}));
vi.mock('../data/load-galaxy', () => ({
  demoGalaxy: () => given.view,
  demoFleets: () => [],
  loadFleets: async () => [],
  loadGalaxy: async () => { if (given.galaxyDown) throw new Error('Supabase: down'); return given.view; },
  loadMe: async () => null,
  loadCrew: async () => [],
}));
vi.mock('../data/load-knowledge', () => ({ loadKnowledge }));

const { default: Page } = await import('../../app/page.tsx');

const user = (email: string) => ({ id: 'u1', email, user_metadata: { given_name: 'Ada' }, identities: [] as [] });
const propsOf = async () => ((await Page()) as ReactElement<{ knowledge?: unknown; view: unknown }>).props;

beforeEach(() => {
  loadKnowledge.mockClear();
  Object.assign(given, { mode: 'demo', user: null, galaxyDown: false });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); });

describe('the arcade page and the star chart', () => {
  it('gives the demo the local checkout\'s knowledge', async () => {
    const props = await propsOf();
    expect(props.knowledge).toBe(given.graph);
    expect(loadKnowledge).toHaveBeenCalledOnce();
  });

  it('gives a crew member signed in the knowledge, with the galaxy', async () => {
    Object.assign(given, { mode: 'supabase', user: user('ada@vertuoza.com') });
    const props = await propsOf();
    expect(props.view).toBe(given.view);
    expect(props.knowledge).toBe(given.graph);
  });

  it.each([
    ['a closed build', { mode: 'closed', user: null }],
    ['a visitor signed out', { mode: 'supabase', user: null }],
    ['an account from another domain', { mode: 'supabase', user: user('eve@example.com') }],
  ] as const)('gives %s no knowledge, and never reads it', async (_, state) => {
    Object.assign(given, state);
    const props = await propsOf();
    expect(props.knowledge).toBeUndefined();
    expect(props.view).toBeNull();
    expect(loadKnowledge).not.toHaveBeenCalled();
  });

  it('gives the crew no knowledge when the galaxy itself is out of reach', async () => {
    Object.assign(given, { mode: 'supabase', user: user('ada@vertuoza.com'), galaxyDown: true });
    const props = await propsOf();
    expect(props.view).toBeNull();
    expect(props.knowledge).toBeUndefined();
  });
});
