import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { item } from '../test/test-item';

// The three Questions pages (PRD 733), called as the server calls them with their reads stubbed: each
// starts with the Questions tabs, its own tab marked, whatever it shows below; a teammate's session,
// opened on its own, has no tab row.

type Given = { mode: 'demo' | 'closed' | 'supabase'; read: unknown; user: null | { id: string }; pane: unknown };
const given = vi.hoisted((): Given => ({ mode: 'closed', read: { kind: 'unavailable' }, user: null, pane: null }));

vi.mock('server-only', () => ({}));
vi.mock('../../env', async (actual) => {
  const env = await actual<typeof import('../../env')>();
  return { ...env, serverEnv: () => ({ ...env.readEnv({}), mode: given.mode }) };
});
vi.mock('../../data/supabase-server', () => ({
  supabaseEnv: () => (given.mode === 'supabase' ? { url: 'http://127.0.0.1:54321', key: 'anon' } : null),
  supabaseServer: () => Promise.resolve({ auth: { getUser: () => Promise.resolve({ data: { user: given.user } }) } }),
}));
vi.mock('./for-me-live', () => ({ readForMeLive: () => Promise.resolve(given.read) }));
vi.mock('./history-live', () => ({ readHistoryLive: () => Promise.resolve(given.read) }));
vi.mock('./source', () => ({
  readTabs: () => Promise.resolve([]),
  readSession: () => Promise.resolve(given.pane),
  readMembers: () => Promise.resolve([]),
  sessionPings: () => () => Promise.resolve(null),
}));

const { QuestionsTabs } = await import('./QuestionsTabs');
const { AskSession } = await import('./AskSession');
const { AskRoute } = await import('./AskRoute');
const { default: ForMePage } = await import('../../../app/ask/for-me/page.tsx');
const { default: HistoryPage } = await import('../../../app/ask/history/page.tsx');

const query = { searchParams: Promise.resolve({}) };
/** The page's children, in order. */
const partsOf = (element: unknown) => {
  const children = (element as ReactElement<{ children: unknown }>).props.children;
  return (Array.isArray(children) ? children : [children]) as ReactElement<{ current?: string }>[];
};
const tabsOf = (element: unknown) => {
  const [first] = partsOf(element);
  return first?.type === QuestionsTabs ? first.props.current : null;
};

beforeEach(() => {
  Object.assign(given, { mode: 'closed', read: { kind: 'unavailable' }, user: null, pane: null });
});

describe('the Questions pages start with their tabs', () => {
  it('/ask/for-me, Shared with me marked, above the notice or the list', async () => {
    expect(tabsOf(await ForMePage(query))).toBe('/ask/for-me');
    given.read = { kind: 'entries', entries: [] };
    const parts = partsOf(await ForMePage(query));
    expect(item(parts, 0).type).toBe(QuestionsTabs);
    expect(parts).toHaveLength(2);
  });

  it('/ask/history, History marked', async () => {
    expect(tabsOf(await HistoryPage(query))).toBe('/ask/history');
    given.read = { kind: 'signed-out', supabase: { url: 'u', key: 'k' } };
    expect(tabsOf(await HistoryPage(query))).toBe('/ask/history');
  });

  it('/ask, Open questions marked: closed, signed out, and the person\'s own terminals', async () => {
    expect(tabsOf(await AskRoute({ id: null, query: {} }))).toBe('/ask');
    given.mode = 'supabase';
    expect(tabsOf(await AskRoute({ id: null, query: {} }))).toBe('/ask');
    given.user = { id: 'ada' };
    expect(tabsOf(await AskRoute({ id: null, query: {} }))).toBe('/ask');
  });

  it('a teammate\'s session, opened on its own, has no tab row', async () => {
    given.mode = 'supabase';
    given.user = { id: 'ada' };
    const id = '00000000-0000-4000-8000-000000000001';
    given.pane = { session: { id, owner: 'bob', workspace_id: 'w' }, rounds: [] };
    const element = (await AskRoute({ id, query: {} })) as ReactElement;
    expect(element.type).toBe(AskSession);
  });
});
