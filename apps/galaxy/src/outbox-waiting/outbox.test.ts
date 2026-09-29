import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakePrdOutboxStore } from '../stages/outbox/store.fake';
import type { OutboxCounts, WaitingQuestion } from '../stages/outbox/store';
import { MAX_DOSSIERS, waitingItems, waitingOutbox, type WaitingDb, type WaitingDeps } from './outbox';

const ME = 'user-me';

type Dossier = { id: string; workspace_id: string; home_repo: string; prd: number | null; title: string; opened_by: string | null; created_at: string };

const dossier = (n: number, extra: Partial<Dossier> = {}): Dossier => ({
  id: `d${n}`, workspace_id: 'w-acme', home_repo: 'acme/widgets', prd: n, title: `PRD ${n} title`, opened_by: ME,
  created_at: new Date(Date.UTC(2026, 8, 1) + n * 60_000).toISOString(), ...extra,
});

const waiting = (id: string, rank: WaitingQuestion['rank']): WaitingQuestion => ({ id, rank, question: `Question of ${id}?` });

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

/** The stored outboxes, with each PRD's counts given, and every read counted. */
async function storeWith(counts: Record<number, OutboxCounts>, workspace = 'w-acme') {
  const store = fakePrdOutboxStore();
  await store.record(Object.entries(counts).map(([prd, c]) => ({ workspace_id: workspace, repository: 'acme/widgets', prd: Number(prd), ...c })));
  return store;
}

const deps = (db: WaitingDb, store: Awaited<ReturnType<typeof storeWith>> | null): WaitingDeps => ({ db: async () => db, outbox: () => store });

const body = async (res: Response) => res.json() as Promise<{ items: Array<Record<string, unknown>>; unread: number; error?: string }>;

describe('waitingItems', () => {
  const d = { id: 'd7', prd: 7, title: 'PRD 7 title' };
  it('names each stored waiting question after its dossier, in the stored order', () => {
    expect(waitingItems(d, { open_questions: 3, waiting: [waiting('s1-01-a', 'human-action'), waiting('s2-01-c', 'high')] })).toEqual([
      { id: 'd7:s1-01-a', prd: 7, dossierId: 'd7', title: 'PRD 7 title', rank: 'human-action', question: 'Question of s1-01-a?' },
      { id: 'd7:s2-01-c', prd: 7, dossierId: 'd7', title: 'PRD 7 title', rank: 'high', question: 'Question of s2-01-c?' },
    ]);
  });

  it('keeps nothing from a PRD with no stored count', () => {
    expect(waitingItems(d, undefined)).toEqual([]);
  });
});

describe('GET /api/waiting/outbox (PRD 657, s5: read from prd_outbox, never GitHub)', () => {
  const github = vi.fn();
  beforeEach(() => { github.mockReset(); vi.stubGlobal('fetch', github); });
  afterEach(() => { expect(github).not.toHaveBeenCalled(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('answers 401 to someone signed out, and reads nothing', async () => {
    const { db, calls } = fakeDb(null, [dossier(1)]);
    const store = await storeWith({});
    const res = await waitingOutbox(deps(db, store));
    expect(res.status).toBe(401);
    expect(Object.keys(await body(res))).toEqual(['error']);
    expect(calls).toEqual([]);
    expect(store.reads).toEqual([]);
  });

  it('answers 401 when there is no database to sign in to', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await waitingOutbox({ db: async () => { throw new Error('Supabase is not configured'); }, outbox: () => null });
    expect(res.status).toBe(401);
  });

  it('answers no items to someone who opened no numbered dossier', async () => {
    const { db } = fakeDb(ME, [dossier(1, { opened_by: 'someone-else' }), dossier(2, { prd: null })]);
    const res = await waitingOutbox(deps(db, await storeWith({})));
    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ items: [], unread: 0 });
  });

  it('reads as the signed-in person their numbered dossiers only, newest first, at most 30, and their outboxes in one read per workspace', async () => {
    const { db, calls } = fakeDb(ME, [...Array.from({ length: 30 }, (_, i) => dossier(i + 1)), dossier(31, { workspace_id: 'w-other' })]);
    const store = await storeWith({});
    await waitingOutbox(deps(db, store));
    expect(calls).toEqual(expect.arrayContaining(['from dossiers', 'eq opened_by', 'not prd is null', 'order created_at desc', `limit ${MAX_DOSSIERS}`]));
    expect(MAX_DOSSIERS).toBe(30);
    expect(store.reads.sort()).toEqual(['w-acme 29', 'w-other 1']);
  });

  it('answers the stored waiting questions, ordered by PRD', async () => {
    const { db } = fakeDb(ME, [dossier(3), dossier(5), dossier(4)]);
    const store = await storeWith({
      3: { open_questions: 3, waiting: [waiting('a', 'human-action'), waiting('b', 'high')] },
      4: { open_questions: 1, waiting: [] },
      5: { open_questions: 1, waiting: [waiting('e', 'high')] },
    });
    const { items, unread } = await body(await waitingOutbox(deps(db, store)));
    expect(items.map((i) => i.id)).toEqual(['d3:a', 'd3:b', 'd5:e']);
    expect(items[0]).toEqual({ id: 'd3:a', prd: 3, dossierId: 'd3', title: 'PRD 3 title', rank: 'human-action', question: 'Question of a?' });
    expect(unread).toBe(0);
  });

  it('counts the dossiers of a workspace whose outboxes could not be read as unread, and keeps the others\' items', async () => {
    const { db } = fakeDb(ME, [dossier(1), dossier(2, { workspace_id: 'w-other' }), dossier(3, { workspace_id: 'w-other' })]);
    const store = await storeWith({ 1: { open_questions: 1, waiting: [waiting('a', 'high')] } });
    const countsOf = store.countsOf.bind(store);
    store.countsOf = async (workspace, prds) => {
      if (workspace === 'w-other') throw new Error('Supabase refused');
      return countsOf(workspace, prds);
    };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { items, unread } = await body(await waitingOutbox(deps(db, store)));
    expect(items.map((i) => i.id)).toEqual(['d1:a']);
    expect(unread).toBe(2);
  });

  it('answers no items and every dossier unread when there is no outbox store', async () => {
    const { db } = fakeDb(ME, [dossier(1), dossier(2)]);
    expect(await body(await waitingOutbox(deps(db, null)))).toEqual({ items: [], unread: 2 });
  });
});
