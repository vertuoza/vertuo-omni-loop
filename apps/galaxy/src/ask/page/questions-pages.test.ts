import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The person's own session page (PRD 733), called as the server calls it with its reads stubbed: it
// starts with the Questions tabs, Open questions (now the Inbox, PRD omni-loop-22 s6) marked; a
// teammate's session, opened on its own, has no tab row.

type Given = { mode: 'demo' | 'closed' | 'supabase'; user: null | { id: string }; pane: unknown };
const given = vi.hoisted((): Given => ({ mode: 'closed', user: null, pane: null }));

vi.mock('server-only', () => ({}));
vi.mock('../../env', async (actual) => {
  const env = await actual<typeof import('../../env')>();
  return { ...env, serverEnv: () => ({ ...env.readEnv({}), mode: given.mode }) };
});
vi.mock('../../data/supabase-server', () => ({
  supabaseEnv: () => (given.mode === 'supabase' ? { url: 'http://127.0.0.1:54321', key: 'anon' } : null),
  supabaseServer: () => Promise.resolve({ auth: { getUser: () => Promise.resolve({ data: { user: given.user } }) } }),
}));
vi.mock('./source', () => ({
  readTabs: () => Promise.resolve([]),
  readSession: () => Promise.resolve(given.pane),
  readMembers: () => Promise.resolve([]),
  sessionPings: () => () => Promise.resolve(null),
}));

const { QuestionsTabs } = await import('./QuestionsTabs');
const { AskSession } = await import('./AskSession');
const { AskRoute } = await import('./AskRoute');

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
  Object.assign(given, { mode: 'closed', user: null, pane: null });
});

describe('the Questions pages start with their tabs', () => {
  it('the Open tab marked, closed, signed out, and the person\'s own terminals', async () => {
    expect(tabsOf(await AskRoute({ id: null, query: {} }))).toBe('/app/inbox');
    given.mode = 'supabase';
    expect(tabsOf(await AskRoute({ id: null, query: {} }))).toBe('/app/inbox');
    given.user = { id: 'ada' };
    expect(tabsOf(await AskRoute({ id: null, query: {} }))).toBe('/app/inbox');
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
