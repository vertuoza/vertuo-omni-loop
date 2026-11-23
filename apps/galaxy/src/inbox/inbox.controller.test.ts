import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../ask/page/history-live', () => ({ readHistoryLive: () => Promise.reject(new Error('not read in a test')) }));

import type { User } from '@supabase/supabase-js';
import { DEMO_TEAMMATE } from '../ask/page/demo';
import type { HistoryRead } from '../ask/page/history-live';
import { readHistory } from '../ask/page/source';
import type { RoundRow, SessionRow } from '../ask/page/view';
import { historyDatabase } from '../ask/page/workspace-history.fake';
import type { HistoryFilters, HistoryRow } from '../ask/page/workspace-history';
import type { MemberSession } from '../data/member-session';
import { doneViewOf, inboxViewOf, type DoneView } from './inbox.controller';

// The Inbox's controller (PRD omni-loop-22, s5): who reads the page decides what it draws, and the Done
// tab's history, or why it could not be read. Since PRD omni-loop-23 the history is read a page at a
// time, with its counts, by the database's own functions (stubbed here: what they read is proved by
// supabase/checks/ask_history_page.sql).

const NOW = Date.parse('2026-11-22T10:00:00Z');

describe('who the Inbox is drawn for', () => {
  it('the demo answers as the demo’s teammate, from the demo', () => {
    expect(inboxViewOf({ kind: 'demo' })).toEqual({ kind: 'answering', source: { kind: 'demo' }, me: DEMO_TEAMMATE });
  });

  it('closed with no database, the sign-in card signed out', () => {
    expect(inboxViewOf({ kind: 'closed' })).toEqual({ kind: 'closed' });
    expect(inboxViewOf({ kind: 'sign-in' })).toEqual({ kind: 'sign-in' });
  });

  it('signed in, answers as that person, through the database the page signs in to', () => {
    const user: Pick<User, 'id'> = { id: 'user-1' };
    const session = { kind: 'signed-in', db: {}, user, env: { url: 'https://db.example', key: 'anon' } } as unknown as MemberSession;
    expect(inboxViewOf(session)).toEqual({ kind: 'answering', source: { kind: 'database', url: 'https://db.example', key: 'anon' }, me: 'user-1' });
  });
});

const at = (minute: number) => new Date(NOW - 100_000 * 60_000 + minute * 60_000).toISOString();
/** A round's id: a uuid, as the database's are, sorting as `n` does. */
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const API: SessionRow = { id: uuid(900_001), owner: 'ada', title: 'api · main', status: 'closed', created_at: at(0), last_seen_at: at(0), repo: 'acme/api', branch: 'main' };
const WEB: SessionRow = { ...API, id: uuid(900_002), title: 'web · main', repo: 'acme/web' };

function answered(n: number, session: SessionRow = API, patch: Partial<RoundRow> = {}): HistoryRow {
  const question = `Question ${String(n)}?`;
  return {
    session,
    round: {
      id: uuid(n), questions: [{ question, header: '', multiSelect: false, options: [{ label: 'Yes' }] }], answers: { [question]: 'Yes' },
      answered_via: 'page', status: 'answered', created_at: at(n), answered_at: at(n), answered_by: 'bob', ...patch,
    },
  };
}

/** The Done tab read from `rows` as the database would page and count them. */
function done(rows: HistoryRow[]) {
  const database = historyDatabase(rows);
  const read = async (filters: HistoryFilters): Promise<HistoryRead> => ({ kind: 'page', ...(await readHistory(database.db, filters)), members: [] });
  const view = async (query: Record<string, string>) => {
    const drawn = await doneViewOf(query, NOW, read);
    if (drawn.kind !== 'history') throw new Error(`the history was not read: ${drawn.kind}`);
    return drawn;
  };
  return { view, calls: database.calls };
}

const ids = (view: Extract<DoneView, { kind: 'history' }>) => view.items.map((item) => item.roundId);

describe('the Done tab', () => {
  const read = (result: HistoryRead) => () => Promise.resolve(result);

  it('is the history, newest first, under the query’s filters', async () => {
    const view = await doneViewOf({}, NOW, read({ kind: 'page', rows: [], facets: [], next: null, members: [] }));
    expect(view).toMatchObject({ kind: 'history', items: [], all: 0, matched: 0, next: null });
  });

  it('passes on a history that could not be read as the person', async () => {
    expect(await doneViewOf({}, NOW, read({ kind: 'unavailable' }))).toEqual({ kind: 'unavailable' });
    const supabase = { url: 'https://db.example', key: 'anon' };
    expect(await doneViewOf({}, NOW, read({ kind: 'signed-out', supabase }))).toEqual({ kind: 'signed-out', supabase });
  });

  it('says the history is unreachable when its read fails, and logs why', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await doneViewOf({}, NOW, () => Promise.reject(new Error('down')))).toEqual({ kind: 'unreachable' });
    expect(log).toHaveBeenCalledOnce();
    log.mockRestore();
  });

  it('says the history is unreachable when the database refuses its read', async () => {
    const database = historyDatabase([answered(1)]);
    database.state.fail = { code: '08006', message: 'connection lost' };
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failing = async (filters: HistoryFilters): Promise<HistoryRead> => ({ kind: 'page', ...(await readHistory(database.db, filters)), members: [] });
    expect(await doneViewOf({}, NOW, failing)).toEqual({ kind: 'unreachable' });
    log.mockRestore();
  });

  it('AC-5: Done pages by 50, Show older going on where the page before stopped, no round twice or skipped', async () => {
    const rows = Array.from({ length: 120 }, (_, i) => answered(i + 1));
    const { view } = done(rows);
    const first = await view({});
    const second = await view({ before: first.next ?? '' });
    const third = await view({ before: second.next ?? '' });
    expect([first.items.length, second.items.length, third.items.length]).toEqual([50, 50, 20]);
    expect(third.next).toBeNull();
    expect([...ids(first), ...ids(second), ...ids(third)]).toEqual(rows.map((r) => r.round.id).reverse());
  });

  it('AC-6: the count is the true total, past a thousand', async () => {
    const { view } = done(Array.from({ length: 1284 }, (_, i) => answered(i + 1)));
    const first = await view({});
    expect(first.all).toBe(1284);
    expect(first.matched).toBe(1284);
    expect(first.items).toHaveLength(50);
  });

  it('AC-9: each category counts under the search and repository chosen, one with none kept at zero', async () => {
    const kube = (n: number, session: SessionRow, category: RoundRow['category']) =>
      answered(n, session, { category, questions: [{ question: `Deploy on kubernetes ${String(n)}?`, header: '', multiSelect: false, options: [{ label: 'Yes' }] }] });
    const { view, calls } = done([
      kube(1, API, 'architecture'), kube(2, WEB, 'architecture'), answered(3, API, { category: 'business' }), kube(4, API, 'product'), kube(5, API, 'product'),
    ]);
    const drawn = await view({ q: 'kubernetes', repo: 'acme/api' });
    expect(calls.find((c) => c.name === 'ask_history_facets')?.args.filters).toEqual({ repo: 'acme/api', search: 'kubernetes' });
    expect(drawn.categories.map((c) => [c.id, c.count])).toEqual([
      ['business', 0], ['product', 2], ['ux-ui', 0], ['architecture', 1], ['harness', 0], ['other', 0], ['unsorted', 0],
    ]);
    expect(drawn.all).toBe(5);
    expect(drawn.matched).toBe(3);
  });

  it('AC-13: a link with category, repo and q applies the same filters, from the newest', async () => {
    const { view, calls } = done([answered(1, API, { category: 'architecture' }), answered(2, WEB, { category: 'architecture' }), answered(3, API, { category: 'business' })]);
    const drawn = await view({ category: 'architecture', repo: 'acme/api', q: 'question' });
    expect(drawn.filters).toEqual({ category: 'architecture', repo: 'acme/api', search: 'question' });
    expect(calls.find((c) => c.name === 'ask_history_page')?.args).toEqual({ filters: { category: 'architecture', repo: 'acme/api', search: 'question' }, before: null, page_size: 51 });
    expect(ids(drawn)).toEqual([uuid(1)]);
    expect(drawn.choices.repos).toEqual(['acme/api']);
  });
});
