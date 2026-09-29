import { describe, expect, it, vi } from 'vitest';
import type { GithubReader } from '../dossier/github/reader';
import { UNREAD, type GithubSummary, type OutboxItem, type PullRef } from '../dossier/github/summary';
import { MAX_DOSSIERS, waitingItems, waitingOutbox, type WaitingDb } from './outbox';

const ME = 'user-me';

type Dossier = { id: string; home_repo: string; prd: number | null; title: string; opened_by: string | null; created_at: string };

const dossier = (n: number, extra: Partial<Dossier> = {}): Dossier => ({
  id: `d${n}`, home_repo: 'acme/widgets', prd: n, title: `PRD ${n} title`, opened_by: ME,
  created_at: new Date(Date.UTC(2026, 8, 1) + n * 60_000).toISOString(), ...extra,
});

const item = (id: string, rank: OutboxItem['rank']): OutboxItem => ({
  id, rank, question: `Question of ${id}?`, decision: null, options: [], personSteps: null,
});

const pull = (state: PullRef['state']): PullRef => ({ number: 9, url: 'https://github.com/acme/widgets/pull/9', state, draft: true });

const summary = (prd: number, feature: GithubSummary['feature'], open: OutboxItem[] | typeof UNREAD = []): GithubSummary => ({
  repo: 'acme/widgets', prd, folder: `0${prd}-x`, topic: 'x', issue: null, phase0: null, feature, retro: null, mergedSlices: 0,
  outbox: open === UNREAD ? UNREAD : { open, settled: [] },
});

type Row = Record<string, unknown>;

/** A fake Supabase client: `user` signed in (or nobody), and the dossiers table filtered the way the query asks. */
function fakeDb(user: string | null, rows: Dossier[]) {
  const calls: string[] = [];
  const db: WaitingDb = {
    auth: { getUser: async () => ({ data: { user: user ? { id: user } : null } }) },
    from(table: string) {
      calls.push(`from ${table}`);
      let result: Row[] = [...rows];
      const query = {
        select(columns: string) { calls.push(`select ${columns}`); return query; },
        eq(column: string, value: unknown) {
          calls.push(`eq ${column}`);
          result = result.filter((r) => r[column] === value);
          return query;
        },
        not(column: string, op: string, value: unknown) {
          calls.push(`not ${column} ${op} ${String(value)}`);
          result = result.filter((r) => r[column] !== null);
          return query;
        },
        order(column: string, { ascending }: { ascending: boolean }) {
          calls.push(`order ${column} ${ascending ? 'asc' : 'desc'}`);
          result.sort((a, b) => (ascending ? 1 : -1) * String(a[column]).localeCompare(String(b[column])));
          return query;
        },
        limit(n: number) { calls.push(`limit ${n}`); result = result.slice(0, n); return query; },
        then(resolve: (value: { data: Row[]; error: null }) => unknown) { return Promise.resolve({ data: result, error: null }).then(resolve); },
      };
      return query as unknown as ReturnType<WaitingDb['from']>;
    },
  };
  return { db, calls };
}

function stubReader(answers: Record<number, GithubSummary | null | Error>): GithubReader & { asked: number[] } {
  const asked: number[] = [];
  return {
    asked,
    async summary({ prd }) {
      asked.push(prd);
      const answer = answers[prd];
      if (answer instanceof Error) throw answer;
      return answer ?? null;
    },
    forget() {},
  };
}

const body = async (res: Response) => res.json() as Promise<{ items: Array<Record<string, unknown>>; unread: number; error?: string }>;

describe('waitingItems', () => {
  const d = { ...dossier(7), prd: 7 };
  it('keeps the human-action and high items of an open feature PR, in the outbox order', () => {
    const s = summary(7, pull('open'), [item('s1-01-a', 'human-action'), item('s1-02-b', 'medium'), item('s2-01-c', 'high')]);
    expect(waitingItems(d, s)).toEqual({
      items: [
        { id: 'd7:s1-01-a', prd: 7, dossierId: 'd7', title: 'PRD 7 title', rank: 'human-action', question: 'Question of s1-01-a?' },
        { id: 'd7:s2-01-c', prd: 7, dossierId: 'd7', title: 'PRD 7 title', rank: 'high', question: 'Question of s2-01-c?' },
      ],
      unread: false,
    });
  });

  it('keeps nothing from a merged or absent feature PR', () => {
    expect(waitingItems(d, summary(7, pull('merged'), [item('a', 'high')]))).toEqual({ items: [], unread: false });
    expect(waitingItems(d, summary(7, null, [item('a', 'high')]))).toEqual({ items: [], unread: false });
  });

  it('keeps nothing, and marks it unread, when the summary, the feature PR or the outbox could not be read', () => {
    expect(waitingItems(d, null)).toEqual({ items: [], unread: true });
    expect(waitingItems(d, summary(7, UNREAD, [item('a', 'high')]))).toEqual({ items: [], unread: true });
    expect(waitingItems(d, summary(7, pull('open'), UNREAD))).toEqual({ items: [], unread: true });
  });

  it('keeps nothing from a PRD with no outbox yet', () => {
    expect(waitingItems(d, { ...summary(7, pull('open')), outbox: null })).toEqual({ items: [], unread: false });
    const { outbox: _outbox, ...before } = summary(7, pull('open'));
    expect(waitingItems(d, before)).toEqual({ items: [], unread: false });
  });
});

describe('GET /api/waiting/outbox', () => {
  it('answers 401 to someone signed out, and reads nothing', async () => {
    const { db, calls } = fakeDb(null, [dossier(1)]);
    const reader = stubReader({});
    const res = await waitingOutbox({ db: async () => db, reader: () => reader });
    expect(res.status).toBe(401);
    expect(Object.keys(await body(res))).toEqual(['error']);
    expect(calls).toEqual([]);
    expect(reader.asked).toEqual([]);
  });

  it('answers 401 when there is no database to sign in to', async () => {
    const res = await waitingOutbox({ db: async () => { throw new Error('Supabase is not configured'); }, reader: () => null });
    expect(res.status).toBe(401);
  });

  it('answers no items to someone who opened no numbered dossier', async () => {
    const { db } = fakeDb(ME, [dossier(1, { opened_by: 'someone-else' }), dossier(2, { prd: null })]);
    const res = await waitingOutbox({ db: async () => db, reader: () => stubReader({}) });
    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ items: [], unread: 0 });
  });

  it('reads as the signed-in person their numbered dossiers only, newest first, at most 30', async () => {
    const { db, calls } = fakeDb(ME, Array.from({ length: 31 }, (_, i) => dossier(i + 1)));
    const reader = stubReader({});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await waitingOutbox({ db: async () => db, reader: () => reader });
    vi.restoreAllMocks();
    expect(calls).toEqual(expect.arrayContaining(['from dossiers', 'eq opened_by', 'not prd is null', 'order created_at desc', `limit ${MAX_DOSSIERS}`]));
    expect(MAX_DOSSIERS).toBe(30);
    expect(reader.asked).toHaveLength(30);
    expect(reader.asked).not.toContain(1);
  });

  it('answers the open feature PRs\' human-action and high items, ordered by PRD', async () => {
    const { db } = fakeDb(ME, [dossier(3), dossier(5), dossier(4)]);
    const reader = stubReader({
      3: summary(3, pull('open'), [item('a', 'human-action'), item('b', 'high'), item('c', 'medium')]),
      4: summary(4, pull('merged'), [item('d', 'high')]),
      5: summary(5, pull('open'), [item('e', 'high')]),
    });
    const { items, unread } = await body(await waitingOutbox({ db: async () => db, reader: () => reader }));
    expect(items.map((i) => i.id)).toEqual(['d3:a', 'd3:b', 'd5:e']);
    expect(items[0]).toEqual({ id: 'd3:a', prd: 3, dossierId: 'd3', title: 'PRD 3 title', rank: 'human-action', question: 'Question of a?' });
    expect(unread).toBe(0);
  });

  it('counts a summary that failed as unread, and keeps the others\' items', async () => {
    const { db } = fakeDb(ME, [dossier(1), dossier(2), dossier(3)]);
    const reader = stubReader({ 1: summary(1, pull('open'), [item('a', 'high')]), 2: new Error('GitHub answered 502'), 3: summary(3, pull('open'), [item('b', 'high')]) });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { items, unread } = await body(await waitingOutbox({ db: async () => db, reader: () => reader }));
    vi.restoreAllMocks();
    expect(items.map((i) => i.id)).toEqual(['d1:a', 'd3:b']);
    expect(unread).toBe(1);
  });

  it('answers no items and every dossier unread when no GitHub reader is configured', async () => {
    const { db } = fakeDb(ME, [dossier(1), dossier(2)]);
    expect(await body(await waitingOutbox({ db: async () => db, reader: () => null }))).toEqual({ items: [], unread: 2 });
  });
});
