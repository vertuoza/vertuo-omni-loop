import { describe, it, expect } from 'vitest';
import { fakeSupabase } from '../store.fake';
import { AskStoreError } from '../store';
import { readSession, readTabs, sendAnswers, sessionReader, tabsReader, type Db } from './source';

const ADA = { id: '00000000-0000-4000-8000-0000000000a1', email: 'ada@vertuoza.com' };
const BOB = { id: '00000000-0000-4000-8000-0000000000b1', email: 'bob@vertuoza.com' };
const START = Date.parse('2026-09-26T09:00:00Z');
const QUESTIONS = [{ question: 'Which storage?', header: 'Storage', multiSelect: false, options: [{ label: 'Postgres (Recommended)' }, { label: 'Memory' }] }];
const ANSWERS = { 'Which storage?': 'Postgres (Recommended)' };

/** A session of Ada's with rounds asked through the fake, and the calls each reader sends. */
async function world() {
  const clock = { now: START };
  const fake = fakeSupabase({ ada: ADA, bob: BOB }, () => clock.now);
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

  it("reads nothing of another person's session, exactly like a missing one", async () => {
    const w = await world();
    await w.ask();
    expect(await readSession(w.recording('bob'), w.sessionId)).toBeNull();
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

describe('reading the tab list', () => {
  /** Ada's sessions: two open, one closed, one idle for 12 hours; and one of Bob's. */
  async function tabsWorld() {
    const w = await world();
    const ada = w.fake.client('ada');
    const bob = w.fake.client('bob');
    const open = async (client: typeof ada, title: string) =>
      ((await client.from('ask_sessions').insert({ title }).select('id').single()) as { data: { id: string } }).data.id;
    const ask = async (sessionId: string, header: string) => {
      w.clock.now += 1000;
      const questions = [{ ...QUESTIONS[0], header }];
      return ((await ada.from('ask_rounds').insert({ session_id: sessionId, questions }).select('id').single()) as { data: { id: string } }).data.id;
    };
    const second = await open(ada, 'vertuo-omni-loop · main');
    const closed = await open(ada, 'vertuo-omni-loop · old');
    const idle = await open(ada, 'vertuo-omni-loop · idle');
    await open(bob, 'vertuo-omni-loop · bob');
    for (const row of w.fake.tables.ask_sessions) {
      if (row.id === closed) row.status = 'closed';
      if (row.id === idle) row.last_seen_at = new Date(w.clock.now - 12 * 60 * 60 * 1000).toISOString();
    }
    return { ...w, second, closed, idle, askIn: ask };
  }

  it("reads the person's open sessions seen within 12 hours, each with its newest round", async () => {
    const w = await tabsWorld();
    await w.askIn(w.sessionId, 'Storage');
    const newest = await w.askIn(w.sessionId, 'Access');
    const rows = await readTabs(w.recording('ada'), w.clock.now);
    expect(rows.map((r) => r.session.id).sort()).toEqual([w.sessionId, w.second].sort());
    const first = rows.find((r) => r.session.id === w.sessionId)!;
    expect(first.newest).toMatchObject({ id: newest, status: 'open', header: 'Access' });
    expect(rows.find((r) => r.session.id === w.second)!.newest).toBeNull();
  });

  it('asks the database for open sessions only, and never reads another person\'s', async () => {
    const w = await tabsWorld();
    await readTabs(w.recording('ada'), w.clock.now);
    expect(w.calls).toContain('ask_sessions.eq("status", "open")');
    expect(await readTabs(w.recording('bob'), w.clock.now)).toHaveLength(1);
  });

  it('reads no rounds when there is no open session', async () => {
    const w = await tabsWorld();
    w.fake.tables.ask_sessions.length = 0;
    w.calls.length = 0;
    expect(await readTabs(w.recording('ada'), w.clock.now)).toEqual([]);
    expect(w.calls.filter((c) => c.startsWith('ask_rounds'))).toEqual([]);
  });

  it("fetches a round's questions once, for its header, and only the newest round's", async () => {
    const w = await tabsWorld();
    await w.askIn(w.sessionId, 'Storage');
    const newest = await w.askIn(w.sessionId, 'Access');
    const read = tabsReader(w.recording('ada'));
    w.calls.length = 0;
    await read(w.clock.now);
    expect(w.calls.filter((c) => c.includes('.in("id"'))).toEqual([`ask_rounds.in("id", ${JSON.stringify([newest])})`]);
    w.calls.length = 0;
    await read(w.clock.now);
    expect(w.calls.filter((c) => c.includes('.in("id"'))).toEqual([]);
  });

  it('throws when the database fails, rather than reading it as empty', async () => {
    const w = await tabsWorld();
    w.fake.state.fail = { code: '08006', message: 'connection lost' };
    await expect(readTabs(w.recording('ada'), w.clock.now)).rejects.toBeInstanceOf(AskStoreError);
  });
});
