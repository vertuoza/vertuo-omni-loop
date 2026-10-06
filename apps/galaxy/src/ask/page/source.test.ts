import { describe, it, expect } from 'vitest';
import { fakeSupabase } from '../store.fake';
import { AskStoreError } from '../store';
import {
  databasePort, questionPort, readForMe, readHistory, readMembers, readQuestion, readSession, readTabs, removeSession, sendAnswers, sessionReader, shareRound, sortRound, tabsReader, withFaces,
  type Db, type SortDb, type StorageDb,
} from './source';
import { stageShots, type Bucket } from './attachments';
import { peopleOf } from '../../people/load';
import { item, present } from '../test/test-item';

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
          const value: unknown = Reflect.get(target, prop, receiver);
          if (typeof value !== 'function' || !['select', 'eq', 'in', 'update'].includes(String(prop))) return value;
          return (...args: unknown[]) => {
            calls.push(`${table}.${String(prop)}(${args.map((a) => JSON.stringify(a)).join(', ')})`);
            Reflect.apply(value, target, args);
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

  it('reads each round with what Claude wrote before asking (PRD 752)', async () => {
    const w = await world();
    const { data } = await w.fake.client('ada').from('ask_rounds')
      .insert({ session_id: w.sessionId, questions: QUESTIONS, lead: 'Here is the design.' }).select('id').single() as { data: { id: string } };
    const state = await readSession(w.recording('ada'), w.sessionId);
    expect(w.calls.find((c) => c.startsWith('ask_rounds.select('))).toMatch(/, lead"\)$/);
    expect(state?.rounds.find((r) => r.id === data.id)?.lead).toBe('Here is the design.');
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

describe('whether the tab\'s terminal is working (PRD 757)', () => {
  const FRESH = { seen_at: new Date(START).toISOString(), ended_at: null };
  const OTHER = { seen_at: new Date(START).toISOString(), ended_at: null };

  /** The heartbeats of two terminals, and which ones a read asked for. */
  function pings() {
    const asked: string[] = [];
    const rows: Record<string, typeof FRESH> = { 'claude-this-tab': FRESH, 'claude-other-tab': OTHER };
    return { asked, read: (id: string) => { asked.push(id); return Promise.resolve(rows[id] ?? null); } };
  }

  it('each poll carries the heartbeat of this tab\'s Claude session, and of no other terminal', async () => {
    const w = await world();
    item(w.fake.tables.ask_sessions, 0).claude_session_id = 'claude-this-tab';
    const p = pings();
    const read = sessionReader(w.recording('ada'), w.sessionId, null, p.read);
    expect((await read())?.ping).toEqual(FRESH);
    expect((await read())?.ping).toEqual(FRESH);
    expect(p.asked).toEqual(['claude-this-tab', 'claude-this-tab']);
  });

  it('the first read carries it too, so the server renders the tab as it stands', async () => {
    const w = await world();
    item(w.fake.tables.ask_sessions, 0).claude_session_id = 'claude-this-tab';
    const p = pings();
    expect((await readSession(w.recording('ada'), w.sessionId, p.read))?.ping).toEqual(FRESH);
  });

  it('a session with no Claude session id asks for no heartbeat, and reads none', async () => {
    const w = await world();
    const p = pings();
    expect((await sessionReader(w.recording('ada'), w.sessionId, null, p.read)())?.ping).toBeNull();
    expect(p.asked).toEqual([]);
  });

  it('a heartbeat out of reach reads as none, and the session is still read', async () => {
    const w = await world();
    await w.ask();
    item(w.fake.tables.ask_sessions, 0).claude_session_id = 'claude-this-tab';
    const state = await sessionReader(w.recording('ada'), w.sessionId, null, () => Promise.reject(new Error('connection lost')))();
    expect(state?.ping).toBeNull();
    expect(state?.rounds).toHaveLength(1);
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
    item(w.fake.tables.ask_rounds, 0).status = 'abandoned';
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

describe('sending with screenshots (PRD 620)', () => {
  const png = (id: string) => ({ id, type: 'image/png', size: 3, file: new Blob([id], { type: 'image/png' }) });

  /** Ada's client, with a stub bucket beside the fake tables. */
  function withBucket(w: Awaited<ReturnType<typeof world>>, token: string) {
    const uploads: string[] = [];
    const removed: string[][] = [];
    const bucket: Bucket = {
      upload(path) {
        uploads.push(path);
        return Promise.resolve({ error: null });
      },
      remove(paths) {
        removed.push(paths);
        return Promise.resolve({ error: null });
      },
    };
    const client = w.fake.client(token) as unknown as Db;
    const db = { from: (table: string) => client.from(table), storage: { from: () => bucket } } as unknown as Db & StorageDb;
    return { db, uploads, removed };
  }

  it('uploads the staged screenshots, then records them with the answer', async () => {
    const w = await world();
    const id = await w.ask();
    stageShots(id, { 'Which storage?': [png('a'), png('b')] });
    const { db, uploads } = withBucket(w, 'ada');
    expect(await sendAnswers(db, id, { 'Which storage?': '(see screenshots)' })).toBe('answered');
    expect(uploads).toEqual([`${id}/1.png`, `${id}/2.png`]);
    expect(w.fake.tables.ask_rounds[0]).toMatchObject({
      status: 'answered', answers: { 'Which storage?': '(see screenshots)' }, attachments: { 'Which storage?': [`${id}/1.png`, `${id}/2.png`] },
    });
  });

  it('deletes the uploads of a round the terminal answered first', async () => {
    const w = await world();
    const id = await w.ask();
    item(w.fake.tables.ask_rounds, 0).status = 'abandoned';
    stageShots(id, { 'Which storage?': [png('a')] });
    const { db, removed } = withBucket(w, 'ada');
    expect(await sendAnswers(db, id, ANSWERS)).toBe('taken');
    expect(removed).toEqual([[`${id}/1.png`]]);
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

describe('sharing a round, and the rounds shared with me (PRD 144)', () => {
  const both = (w: Awaited<ReturnType<typeof world>>, token: string) => w.fake.client(token) as unknown as Db & SortDb & StorageDb;

  it('lets the owner share a round with a member, and only the owner', async () => {
    const w = await world();
    const id = await w.ask();
    expect(await shareRound(both(w, 'bob'), id, ADA.id)).toBe(false);
    expect(await shareRound(both(w, 'ada'), id, CARL.id)).toBe(false);
    expect(await shareRound(both(w, 'ada'), id, BOB.id)).toBe(true);
    const state = await readSession(w.as('ada'), w.sessionId);
    expect(await databasePort(both(w, 'ada'), present(state, 'state')).share(id, BOB.id)).toBe(true);
    expect(w.fake.tables.ask_shares).toHaveLength(1);
  });

  it('reads one round with its session, the session\'s other rounds and who it is shared with', async () => {
    const w = await world();
    const first = await w.ask();
    const second = await w.ask();
    await shareRound(both(w, 'ada'), second, BOB.id);
    const state = await readQuestion(both(w, 'bob'), second);
    expect(state?.session).toMatchObject({ id: w.sessionId, owner: ADA.id });
    expect(state?.round).toMatchObject({ id: second, status: 'open', questions: QUESTIONS });
    expect(state?.round).not.toHaveProperty('session_id');
    expect(state?.earlier.map((r) => r.id)).toEqual([first]);
    expect(state?.sharedWith).toEqual([BOB.id]);
    expect(await readQuestion(both(w, 'carl'), second)).toBeNull();
    expect(await readQuestion(both(w, 'bob'), '00000000-0000-4000-8000-00000000ffff')).toBeNull();
  });

  it('answers a shared round from its page; the second answer is taken', async () => {
    const w = await world();
    const id = await w.ask();
    await shareRound(both(w, 'ada'), id, BOB.id);
    expect(await questionPort(both(w, 'bob'), id).send(id, ANSWERS)).toBe('answered');
    expect(await questionPort(both(w, 'ada'), id).send(id, ANSWERS)).toBe('taken');
    expect((await questionPort(both(w, 'ada'), id).read())?.round).toMatchObject({ status: 'answered', answered_by: BOB.id });
  });

  it('lists the open rounds shared with me, with their session and who shared them', async () => {
    const w = await world();
    const open = await w.ask();
    const done = await w.ask();
    await w.ask();
    await shareRound(both(w, 'ada'), open, BOB.id);
    await shareRound(both(w, 'ada'), done, BOB.id);
    await sendAnswers(w.as('ada'), done, ANSWERS);
    const rows = await readForMe(both(w, 'bob'), BOB.id);
    expect(rows.map((r) => [r.round.id, r.session.id, r.sharedBy])).toEqual([[open, w.sessionId, ADA.id]]);
    expect(await readForMe(both(w, 'ada'), ADA.id)).toEqual([]);
    expect(await readForMe(both(w, 'carl'), CARL.id)).toEqual([]);
  });

  it('lists the members of my workspace, and nobody for a workspace I am not in or none', async () => {
    const w = await world();
    const state = await readSession(w.as('ada'), w.sessionId);
    const members = await readMembers(both(w, 'bob'), present(state, 'state').session.workspace_id);
    expect(members.map((m) => m.email).sort()).toEqual(['ada@vertuoza.com', 'bob@vertuoza.com']);
    expect(await readMembers(both(w, 'carl'), present(state, 'state').session.workspace_id)).toEqual([]);
    expect(await readMembers(both(w, 'bob'), null)).toEqual([]);
  });

  it('gives each member a face; with no people directory to read, the initial of their name (PRD 652)', async () => {
    const w = await world();
    const state = await readSession(w.as('ada'), w.sessionId);
    const members = await readMembers(both(w, 'bob'), present(state, 'state').session.workspace_id);
    expect(members.map((m) => m.face).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))))
      .toEqual([{ kind: 'initial', letter: 'A' }, { kind: 'initial', letter: 'B' }]);
  });
});

describe('members\' faces (PRD 652)', () => {
  const members = [
    { user_id: 'u-ada', email: 'ada@vertuoza.com', name: 'ADA' },
    { user_id: 'u-bob', email: 'bob@vertuoza.com', name: null },
    { user_id: 'u-cat', email: 'cat@vertuoza.com', name: 'CAT' },
  ];
  const roster = [
    { user_id: 'u-ada', name: 'ADA', github_login: 'ada', avatar_url: 'https://avatars.example/ada.png', fleet: null },
    { user_id: 'u-bob', name: null, github_login: 'bob-gh', avatar_url: null, fleet: null },
  ];

  it('resolves each member by account id through the directory: avatar, else the login\'s GitHub photo, else the initial', () => {
    expect(withFaces(members, peopleOf(roster, [])).map((m) => m.face)).toEqual([
      { kind: 'photo', url: 'https://avatars.example/ada.png' },
      { kind: 'photo', url: 'https://github.com/bob-gh.png?size=48' },
      { kind: 'initial', letter: 'C' },
    ]);
  });

  it('keeps every member, named as before, when the directory could not be read', () => {
    const faced = withFaces(members, peopleOf([], []));
    expect(faced.map((member) => {
      const m = { ...member };
      delete m.face;
      return m;
    })).toEqual(members);
    expect(faced.map((m) => m.face)).toEqual([{ kind: 'initial', letter: 'A' }, { kind: 'initial', letter: 'B' }, { kind: 'initial', letter: 'C' }]);
  });
});

describe('the workspace history (PRD 144)', () => {
  it('reads every round of my workspaces with its session, newest first, and nothing of another workspace', async () => {
    const w = await world();
    const first = await w.ask();
    const second = await w.ask();
    const carl = w.fake.client('carl');
    const { data: elsewhere } = await carl.from('ask_sessions').insert({ title: 'elsewhere' }).select('id').single() as { data: { id: string } };
    w.clock.now += 1000;
    await carl.from('ask_rounds').insert({ session_id: elsewhere.id, questions: QUESTIONS }).select('id').single();

    for (const token of ['ada', 'bob']) {
      const rows = await readHistory(w.as(token));
      expect(rows.map((r) => [r.round.id, r.session.id]), token).toEqual([[second, w.sessionId], [first, w.sessionId]]);
      expect(item(rows, 0).round).not.toHaveProperty('session_id');
    }
    expect((await readHistory(w.as('carl'))).map((r) => r.session.title)).toEqual(['elsewhere']);
  });

  it('reads the newest rounds up to its limit', async () => {
    const w = await world();
    await w.ask();
    const second = await w.ask();
    const third = await w.ask();
    expect((await readHistory(w.as('ada'), 2)).map((r) => r.round.id)).toEqual([third, second]);
  });

  it('reads nothing when there is nothing, and throws when the database fails', async () => {
    const w = await world();
    expect(await readHistory(w.as('ada'))).toEqual([]);
    w.fake.state.fail = { code: '08006', message: 'connection lost' };
    await expect(readHistory(w.as('ada'))).rejects.toBeInstanceOf(AskStoreError);
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
    const rows = await readTabs(w.recording('ada'), ADA.id, w.clock.now);
    expect(rows.map((r) => r.session.id).sort()).toEqual([w.sessionId, w.second].sort());
    const first = present(rows.find((r) => r.session.id === w.sessionId), 'rows.find((r) => r.session.id === w.sessionId)');
    expect(first.newest).toMatchObject({ id: newest, status: 'open', header: 'Access' });
    expect(present(rows.find((r) => r.session.id === w.second), 'rows.find((r) => r.session.id === w.second)').newest).toBeNull();
  });

  it('asks the database for open sessions only, and never reads another person\'s, even a teammate\'s (PRD 144)', async () => {
    const w = await tabsWorld();
    await readTabs(w.recording('ada'), ADA.id, w.clock.now);
    expect(w.calls).toContain('ask_sessions.eq("status", "open")');
    expect(w.calls).toContain(`ask_sessions.eq("owner", ${JSON.stringify(ADA.id)})`);
    expect(await readTabs(w.recording('bob'), BOB.id, w.clock.now)).toHaveLength(1);
  });

  it('reads no rounds when there is no open session', async () => {
    const w = await tabsWorld();
    w.fake.tables.ask_sessions.length = 0;
    w.calls.length = 0;
    expect(await readTabs(w.recording('ada'), ADA.id, w.clock.now)).toEqual([]);
    expect(w.calls.filter((c) => c.startsWith('ask_rounds'))).toEqual([]);
  });

  it("fetches a round's questions once, for its header, and only the newest round's", async () => {
    const w = await tabsWorld();
    await w.askIn(w.sessionId, 'Storage');
    const newest = await w.askIn(w.sessionId, 'Access');
    const read = tabsReader(w.recording('ada'), ADA.id);
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
    await expect(readTabs(w.recording('ada'), ADA.id, w.clock.now)).rejects.toBeInstanceOf(AskStoreError);
  });
});
