import { readFileSync } from 'node:fs';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The arcade page (app/play/page.tsx), called as the server calls it, with its data sources stubbed: which
// visitor's page carries the star chart's knowledge, and that every page hands the arcade the app it
// leaves for. The props it returns are what reaches the browser.
const given = vi.hoisted(() => ({
  mode: 'demo',
  user: null as null | { id: string; email: string; user_metadata: Record<string, string>; identities: [] },
  galaxyDown: false,
  graph: { version: 1, repo: 'acme/widgets', domains: [], entries: [], links: [], loose: [], unserved: [] },
  view: { planets: [], sectors: [], teams: [] },
}));
const loadKnowledge = vi.hoisted(() => vi.fn(() => given.graph));

vi.mock('server-only', () => ({}));
vi.mock('../env', async (actual) => {
  const env = await actual<typeof import('../env')>();
  return { ...env, serverEnv: () => ({ ...env.readEnv({}), mode: given.mode }) };
});
vi.mock('../data/supabase-server', () => ({
  supabaseEnv: () => (given.mode === 'supabase' ? { url: 'http://127.0.0.1:54321', key: 'anon' } : null),
  supabaseServer: () => Promise.resolve({ auth: { getUser: () => Promise.resolve({ data: { user: given.user } }) } }),
}));
// Crew is membership of a workspace: here, the vertuoza workspace holds every @vertuoza.com account.
vi.mock('../data/workspace', () => ({
  memberWorkspace: (_db: unknown, id: string) =>
    Promise.resolve(given.user?.id === id && given.user.email.endsWith('@vertuoza.com') ? { id: 'w1', slug: 'vertuoza', name: 'Vertuoza', theme: {} } : null),
  brandOf: ({ name, theme }: { name: string; theme: Record<string, string> }) => ({ name, theme }),
}));
vi.mock('../data/load-galaxy', () => ({
  demoGalaxy: () => given.view,
  demoFleets: () => [],
  loadFleets: () => Promise.resolve([]),
  loadGalaxy: () => (given.galaxyDown ? Promise.reject(new Error('Supabase: down')) : Promise.resolve(given.view)),
  loadMe: () => Promise.resolve(null),
  loadCrew: () => Promise.resolve([]),
}));
vi.mock('../data/load-knowledge', () => ({ loadKnowledge }));

const { default: Page } = await import('../../app/play/page.tsx');

const user = (email: string) => ({ id: 'u1', email, user_metadata: { given_name: 'Ada' }, identities: [] as [] });
const propsOf = async () => ((await Page()) as ReactElement<{ knowledge?: unknown; view: unknown; app?: string }>).props;

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
    ['an account in no workspace', { mode: 'supabase', user: user('eve@example.com') }],
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

// The app the arcade leaves for (PRD 238): the page hands its home to the arcade, whoever is at it,
// so the APP MODE row shows; the single-file artifact has no server and no /app, so it hands none.
describe('the arcade page and the app', () => {
  it.each([
    ['the demo', { mode: 'demo', user: null }],
    ['a closed build', { mode: 'closed', user: null }],
    ['a visitor signed out', { mode: 'supabase', user: null }],
    ['an account in no workspace', { mode: 'supabase', user: user('eve@example.com') }],
    ['a crew member signed in', { mode: 'supabase', user: user('ada@vertuoza.com') }],
    ['a crew member whose galaxy is out of reach', { mode: 'supabase', user: user('ada@vertuoza.com'), galaxyDown: true }],
  ] as const)('hands %s\'s arcade the app, at /app', async (_, state) => {
    Object.assign(given, state);
    expect((await propsOf()).app).toBe('/app');
  });

  it('is not handed to the single-file artifact\'s arcade', () => {
    const entry = readFileSync(new URL('../../artifact/entry.tsx', import.meta.url), 'utf8');
    const arcade = /<ArcadeApp\b[^>]*\/>/.exec(entry)?.[0];
    expect(arcade).toBeTruthy();
    expect(arcade).not.toMatch(/\bapp=/);
    expect(entry).not.toMatch(/APP_HOME|src\/switch/);
  });
});
