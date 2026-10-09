import { describe, expect, it } from 'vitest';
import { fakeSupabase } from './store.fake';
import { AskStoreError } from './store';
import { readQuestion, readSession, readTabs, shareRound, type Db, type SortDb } from './page/source';
import { item } from './test/test-item';
import { askReadRepository } from './ask.repository';
import { askReadService, askWayBack } from './ask.service';

// The ask pages' three reads (PRD 1318, s2): the tabs, a session with its rounds, and a round with its
// session and shares. Characterization first: what the page's readers (src/ask/page/source.ts) gave
// on the fakes before the move is pinned here, and the same comes back through the service after it.

const ADA = { id: '00000000-0000-4000-8000-0000000000a1', email: 'ada@vertuoza.com' };
const BOB = { id: '00000000-0000-4000-8000-0000000000b1', email: 'bob@vertuoza.com' };
const CARL = { id: '00000000-0000-4000-8000-0000000000c1', email: 'carl@vertuoza.com', workspaces: ['00000000-0000-4000-8000-00000000aced'] };
const START = Date.parse('2026-09-26T09:00:00Z');
const QUESTIONS = [{ question: 'Which storage?', header: 'Storage', multiSelect: false, options: [{ label: 'Postgres (Recommended)' }, { label: 'Memory' }] }];
const LATER = [{ question: 'Which cache?', header: 'Cache', multiSelect: false, options: [{ label: 'None' }] }];

/** Ada's session with two rounds, the second shared with Bob, and each reader as a person. */
async function world() {
  const clock = { now: START };
  const fake = fakeSupabase({ ada: ADA, bob: BOB, carl: CARL }, () => clock.now);
  const ada = fake.client('ada');
  const { data: session } = await ada.from('ask_sessions').insert({ title: 'vertuo-omni-loop · feat/ask-mode' }).select('id').single() as { data: { id: string } };
  const ask = async (questions: unknown[]) => {
    clock.now += 1000;
    const { data } = await ada.from('ask_rounds').insert({ session_id: session.id, questions }).select('id').single() as { data: { id: string } };
    return data.id;
  };
  const first = await ask(QUESTIONS);
  const second = await ask(LATER);
  await shareRound(fake.client('ada') as unknown as Db & SortDb, second, BOB.id);
  item(fake.tables.ask_sessions, 0).claude_session_id = 'claude-this-tab';
  // The stub answers only the query shapes the page sends, so it is not a whole Supabase client.
  const as = (token: string) => fake.client(token) as unknown as Db & SortDb;
  return { fake, clock, as, sessionId: session.id, first, second };
}

const PING = { seen_at: new Date(START).toISOString(), ended_at: null };
const pings = (id: string) => Promise.resolve(id === 'claude-this-tab' ? PING : null);

/** The pinned shape of each read, from the scenario: what the person sees. */
function pinned(w: Awaited<ReturnType<typeof world>>) {
  const session = { id: w.sessionId, owner: ADA.id, title: 'vertuo-omni-loop · feat/ask-mode', status: 'open', claude_session_id: 'claude-this-tab' };
  return {
    session,
    rounds: [[w.first, 'open', QUESTIONS], [w.second, 'open', LATER]],
    tabs: [{ id: w.sessionId, newest: { id: w.second, status: 'open', created_at: new Date(START + 2000).toISOString(), header: 'Cache' } }],
  };
}

const roundsOf = (rounds: Array<{ id: string; status: string; questions: unknown }>) => rounds.map((r) => [r.id, r.status, r.questions]);

describe('the ask pages\' reads, as the page read them before the move', () => {
  it('a session with its rounds and its terminal\'s heartbeat', async () => {
    const w = await world();
    const state = await readSession(w.as('ada'), w.sessionId, pings);
    expect(state?.session).toMatchObject(pinned(w).session);
    expect(roundsOf(state?.rounds ?? [])).toEqual(pinned(w).rounds);
    expect(state?.ping).toEqual(PING);
  });

  it('the tabs: the person\'s open sessions, each with its newest round and its header', async () => {
    const w = await world();
    const tabs = await readTabs(w.as('ada'), ADA.id, w.clock.now);
    expect(tabs.map((t) => ({ id: t.session.id, newest: t.newest }))).toEqual(pinned(w).tabs);
    expect(await readTabs(w.as('bob'), BOB.id, w.clock.now)).toEqual([]);
  });

  it('a round with its session, the session\'s other rounds and who it is shared with', async () => {
    const w = await world();
    const state = await readQuestion(w.as('bob'), w.second);
    expect(state?.session).toMatchObject(pinned(w).session);
    expect(state?.round).toMatchObject({ id: w.second, questions: LATER, status: 'open' });
    expect(state?.round).not.toHaveProperty('session_id');
    expect(roundsOf(state?.earlier ?? [])).toEqual([[w.first, 'open', QUESTIONS]]);
    expect(state?.sharedWith).toEqual([BOB.id]);
  });

  it('another workspace\'s session or round reads as missing; a failed read throws', async () => {
    const w = await world();
    expect(await readSession(w.as('carl'), w.sessionId)).toBeNull();
    expect(await readQuestion(w.as('carl'), w.second)).toBeNull();
    w.fake.state.fail = { code: '08006', message: 'connection lost' };
    await expect(readSession(w.as('ada'), w.sessionId)).rejects.toBeInstanceOf(AskStoreError);
  });
});

describe('the same reads, through the service after the move', () => {
  const reads = (w: Awaited<ReturnType<typeof world>>, token: string) =>
    askReadService({ ...askReadRepository(w.as(token)), ping: pings });

  it('a session with its rounds and its terminal\'s heartbeat', async () => {
    const w = await world();
    const state = await reads(w, 'ada').session(w.sessionId);
    expect(state?.session).toMatchObject(pinned(w).session);
    expect(roundsOf(state?.rounds ?? [])).toEqual(pinned(w).rounds);
    expect(state?.ping).toEqual(PING);
  });

  it('a session read for a shared round carries no heartbeat', async () => {
    const w = await world();
    expect(await reads(w, 'ada').session(w.sessionId, { ping: false })).not.toHaveProperty('ping');
  });

  it('the tabs, each newest round\'s header read once for a caller that reads again', async () => {
    const w = await world();
    const tabs = await reads(w, 'ada').tabs(ADA.id, w.clock.now);
    expect(tabs.map((t) => ({ id: t.session.id, newest: t.newest }))).toEqual(pinned(w).tabs);
    expect(await reads(w, 'bob').tabs(BOB.id, w.clock.now)).toEqual([]);
    const headers = new Map([[w.second, 'Kept']]);
    expect((await reads(w, 'ada').tabs(ADA.id, w.clock.now, headers))[0]?.newest?.header).toBe('Kept');
  });

  it('a round with its session, the session\'s other rounds and who it is shared with', async () => {
    const w = await world();
    const state = await reads(w, 'bob').question(w.second);
    expect(state?.session).toMatchObject(pinned(w).session);
    expect(state?.round).toMatchObject({ id: w.second, questions: LATER, status: 'open' });
    expect(state?.round).not.toHaveProperty('session_id');
    expect(roundsOf(state?.earlier ?? [])).toEqual([[w.first, 'open', QUESTIONS]]);
    expect(state?.sharedWith).toEqual([BOB.id]);
  });

  it('another workspace\'s session or round reads as missing; a failed read throws', async () => {
    const w = await world();
    expect(await reads(w, 'carl').session(w.sessionId)).toBeNull();
    expect(await reads(w, 'carl').question(w.second)).toBeNull();
    w.fake.state.fail = { code: '08006', message: 'connection lost' };
    await expect(reads(w, 'ada').session(w.sessionId)).rejects.toBeInstanceOf(AskStoreError);
  });

  it('a heartbeat out of reach reads as none, and the session is still read', async () => {
    const w = await world();
    const state = await askReadService({ ...askReadRepository(w.as('ada')), ping: () => Promise.reject(new Error('gone')) }).session(w.sessionId);
    expect(state?.ping).toBeNull();
    expect(state?.rounds).toHaveLength(2);
  });
});

describe('the way back (PRD 384; PRD 1318, s3)', () => {
  it('hands back which of a dossier\'s rounds are open and when each was asked, and nothing else of them', async () => {
    const asked: Array<{ fn: string; args: unknown }> = [];
    const row = { rule: 'asked', round_id: 'r1', session_id: 's1', asked_by: 'ada', repo: null, branch: null, questions: [], answers: null, status: 'open', answered_via: null,
      answered_by: null, category: null, category_by: null, prd: null, skill: null, created_at: '2026-10-09T08:30:00Z', answered_at: null };
    const db = { rpc: (fn: string, args: unknown) => { asked.push({ fn, args }); return Promise.resolve({ data: [row], error: null }); } };
    // The stub answers only dossier_rounds(), so it is not a whole Supabase client.
    expect(await askWayBack(db as unknown as Parameters<typeof askWayBack>[0])('d1')).toEqual([{ round_id: 'r1', status: 'open', created_at: '2026-10-09T08:30:00Z' }]);
    expect(asked).toEqual([{ fn: 'dossier_rounds', args: { p_dossier: 'd1' } }]);
  });
});
