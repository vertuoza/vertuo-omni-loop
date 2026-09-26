import { describe, it, expect } from 'vitest';
import { fakeSupabase } from '../store.fake';
import { AskStoreError } from '../store';
import { readSession, removeSession, sendAnswers, sessionReader, sortRound, type Db, type SortDb } from './source';

const ADA = { id: '00000000-0000-4000-8000-0000000000a1', email: 'ada@vertuoza.com' };
const BOB = { id: '00000000-0000-4000-8000-0000000000b1', email: 'bob@vertuoza.com' };
// Bob shares Ada's workspace (the fake's default); Carl belongs to another one.
const CARL = { id: '00000000-0000-4000-8000-0000000000c1', email: 'carl@vertuoza.com', workspaces: ['00000000-0000-4000-8000-00000000aced'] };
const START = Date.parse('2026-09-26T09:00:00Z');
const QUESTIONS = [{ question: 'Which storage?', header: 'Storage', multiSelect: false, options: [{ label: 'Postgres (Recommended)' }, { label: 'Memory' }] }];
const ANSWERS = { 'Which storage?': 'Postgres (Recommended)' };

/** A session of Ada's with rounds asked through the fake, and the calls each reader sends. */
async function world() {
  const clock = { now: START };
  const fake = fakeSupabase({ ada: ADA, bob: BOB, carl: CARL }, () => clock.now);
  const calls: string[] = [];
  // Records each query's table and filters, so a test can see what a poll fetched again.
  const recording = (token: string): Db => ({
    from(table: string) {
      const query = fake.client(token).from(table as 'ask_sessions');
      const proxy: unknown = new Proxy(query, {
        get(target, prop, receiver) {
          const value = Reflect.get(target, prop, receiver);
          if (typeof value !== 'function' || !['select', 'eq', 'in', 'update'].includes(String(prop))) return value;
          return (...args: unknown[]) => {
            calls.push(`${table}.${String(prop)}(${args.map((a) => JSON.stringify(a)).join(', ')})`);
            value.apply(target, args);
            return proxy;
          };
        },
      });
      return proxy as ReturnType<Db['from']>;
    },
  });
  const ada = fake.client('ada');
  const { data: session } = await ada.from('ask_sessions').insert({ title: 'vertuo-omni-loop · feat/ask-mode' }).select('id').single() as { data: { id: string } };
  const ask = async () => {
    clock.now += 1000;
    const { data } = await ada.from('ask_rounds').insert({ session_id: session.id, questions: QUESTIONS }).select('id').single() as { data: { id: string } };
    return data.id;
  };
  // The stub answers only the query shapes the page sends, so it is not a whole Supabase client.
  const as = (token: string) => fake.client(token) as unknown as Db;
  return { fake, clock, calls, recording, as, sessionId: session.id, ask };
}

describe('reading a session', () => {
  it('reads the session and every round, as its owner', async () => {
    const w = await world();
    const first = await w.ask();
    const second = await w.ask();
    const state = await readSession(w.recording('ada'), w.sessionId);
    expect(state?.session).toMatchObject({ id: w.sessionId, owner: ADA.id, title: 'vertuo-omni-loop · feat/ask-mode', status: 'open' });
    expect(state?.rounds.map((r) => [r.id, r.status, r.questions])).toEqual([[first, 'open', QUESTIONS], [second, 'open', QUESTIONS]]);
  });

  it('reads the session and its rounds as another member of its workspace (PRD 144)', async () => {
    const w = await world();
    const first = await w.ask();
    const state = await readSession(w.recording('bob'), w.sessionId);
    expect(state?.session).toMatchObject({ id: w.sessionId, owner: ADA.id });
    expect(state?.rounds.map((r) => r.id)).toEqual([first]);
  });

  it('reads nothing of a session of another workspace, exactly like a missing one', async () => {
    const w = await world();
    await w.ask();
    expect(await readSession(w.recording('carl'), w.sessionId)).toBeNull();
    expect(await readSession(w.recording('ada'), '00000000-0000-4000-8000-00000000ffff')).toBeNull();
  });

  it('throws when the database fails, rather than reading it as empty', async () => {
    const w = await world();
    w.fake.state.fail = { code: '08006', message: 'connection lost' };
    await expect(readSession(w.recording('ada'), w.sessionId)).rejects.toBeInstanceOf(AskStoreError);
  });
});

describe('polling', () => {
  it('fetches the questions of a round once, and again only when its status moves', async () => {
    const w = await world();
    const first = await w.ask();
    const read = sessionReader(w.recording('ada'), w.sessionId);
    expect((await read())?.rounds).toHaveLength(1);

    w.calls.length = 0;
    expect((await read())?.rounds.map((r) => r.status)).toEqual(['open']);
    expect(w.calls.filter((c) => c.includes('.in('))).toEqual([]);

    const second = await w.ask();
    w.calls.length = 0;
    expect((await read())?.rounds.map((r) => r.id)).toEqual([first, second]);
    expect(w.calls.filter((c) => c.includes('.in('))).toEqual([`ask_rounds.in("id", ${JSON.stringify([second])})`]);

    await sendAnswers(w.as('ada'), first, ANSWERS);
    w.calls.length = 0;
    const state = await read();
    expect(state?.rounds.find((r) => r.id === first)).toMatchObject({ status: 'answered', answered_via: 'page', answers: ANSWERS });
    expect(w.calls.filter((c) => c.includes('.in('))).toEqual([`ask_rounds.in("id", ${JSON.stringify([first])})`]);
  });

  it('starts from what the server already read', async () => {
    const w = await world();
    await w.ask();
    const seed = await readSession(w.recording('ada'), w.sessionId);
    const read = sessionReader(w.recording('ada'), w.sessionId, seed);
    w.calls.length = 0;
    expect((await read())?.rounds).toHaveLength(1);
    expect(w.calls.filter((c) => c.includes('.in('))).toEqual([]);
  });

  it('reads null once the session is gone', async () => {
    const w = await world();
    const read = sessionReader(w.recording('ada'), w.sessionId);
    w.fake.tables.ask_sessions.length = 0;
    expect(await read()).toBeNull();
  });
});

describe('sending the answers', () => {
  it('answers an open round, tagged page', async () => {
    const w = await world();
    const id = await w.ask();
    expect(await sendAnswers(w.as('ada'), id, ANSWERS)).toBe('answered');
    expect(w.fake.tables.ask_rounds[0]).toMatchObject({ status: 'answered', answers: ANSWERS, answered_via: 'page' });
  });

  it('never answers a round the terminal took over, or one already answered', async () => {
    const w = await world();
    const id = await w.ask();
    w.fake.tables.ask_rounds[0].status = 'abandoned';
    expect(await sendAnswers(w.as('ada'), id, ANSWERS)).toBe('taken');
    expect(w.fake.tables.ask_rounds[0]).toMatchObject({ status: 'abandoned', answers: null });

    w.fake.tables.ask_rounds[0] = { ...w.fake.tables.ask_rounds[0], status: 'answered', answers: { 'Which storage?': 'Memory' }, answered_via: 'terminal' };
    expect(await sendAnswers(w.as('ada'), id, ANSWERS)).toBe('taken');
    expect(w.fake.tables.ask_rounds[0]).toMatchObject({ answers: { 'Which storage?': 'Memory' }, answered_via: 'terminal' });
  });

  it("never answers another person's round", async () => {
    const w = await world();
    const id = await w.ask();
    expect(await sendAnswers(w.as('bob'), id, ANSWERS)).toBe('taken');
    expect(w.fake.tables.ask_rounds[0]).toMatchObject({ status: 'open' });
  });
});

describe('deleting the session (PRD 144)', () => {
  it('deletes it and its rounds for its owner', async () => {
    const w = await world();
    await w.ask();
    expect(await removeSession(w.as('ada'), w.sessionId)).toBe(true);
    expect(w.fake.tables.ask_sessions).toEqual([]);
    expect(w.fake.tables.ask_rounds).toEqual([]);
  });

  it('deletes nothing for a member who is not the owner, nor for another workspace', async () => {
    const w = await world();
    await w.ask();
    expect(await removeSession(w.as('bob'), w.sessionId)).toBe(false);
    expect(await removeSession(w.as('carl'), w.sessionId)).toBe(false);
    expect(w.fake.tables.ask_sessions).toHaveLength(1);
    expect(w.fake.tables.ask_rounds).toHaveLength(1);
  });
});

describe('sorting a round (PRD 144)', () => {
  // The stub answers only the calls the page sends, so it is not a whole Supabase client.
  const sorter = (w: Awaited<ReturnType<typeof world>>, token: string) => w.fake.client(token) as unknown as SortDb;

  it('lets any member of the workspace set one of the six, or clear it, and says who did', async () => {
    const w = await world();
    const id = await w.ask();
    expect(await sortRound(sorter(w, 'bob'), id, 'product')).toEqual({ category: 'product', category_by: BOB.id });
    expect(await sortRound(sorter(w, 'ada'), id, null)).toEqual({ category: null, category_by: ADA.id });
    expect(w.fake.tables.ask_rounds[0]).toMatchObject({ category: null, category_by: ADA.id });
  });

  it('sorts nothing for an account of another workspace', async () => {
    const w = await world();
    const id = await w.ask();
    expect(await sortRound(sorter(w, 'carl'), id, 'business')).toBeNull();
    expect(w.fake.tables.ask_rounds[0]).toMatchObject({ category: null, category_by: null });
  });

  it('is read again by the poll once someone else sorts the round', async () => {
    const w = await world();
    const id = await w.ask();
    const read = sessionReader(w.recording('ada'), w.sessionId);
    expect((await read())?.rounds[0]).toMatchObject({ category: null });
    await sortRound(sorter(w, 'bob'), id, 'ux-ui');
    w.calls.length = 0;
    expect((await read())?.rounds[0]).toMatchObject({ category: 'ux-ui', category_by: BOB.id });
    expect(w.calls.filter((c) => c.includes('.in('))).toEqual([`ask_rounds.in("id", ${JSON.stringify([id])})`]);
  });
});
