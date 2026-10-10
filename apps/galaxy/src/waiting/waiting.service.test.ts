import { describe, expect, it } from 'vitest';
import { fakeSupabase } from '../ask/store.fake';
import { sendAnswers, shareRound, type Db, type SortDb } from '../ask/page/source';
import { waitingReads } from './waiting.service';
import { DOCS_LIMIT, type WaitingDb } from './waiting.repository';
import { DOCS_DAYS } from './documents';

// The Questions part read from the database as the signed-in person (PRD 499), through the waiting
// service since PRD 1318 (s4), on the ask pages' fake
// Supabase: the person's own sessions' open rounds and the rounds shared with them, as one list.

const ADA = { id: '00000000-0000-4000-8000-0000000000a1', email: 'ada@vertuoza.com', name: 'Ada' };
const BOB = { id: '00000000-0000-4000-8000-0000000000b1', email: 'bob@vertuoza.com' };
const START = Date.parse('2026-09-28T09:00:00Z');
const question = (text: string) => [{ question: text, header: 'Pick', multiSelect: false, options: [{ label: 'Yes' }, { label: 'No' }] }];

function world() {
  const clock = { now: START };
  const fake = fakeSupabase({ ada: ADA, bob: BOB }, () => clock.now);
  const as = (token: string) => fake.client(token) as unknown as Db & SortDb;
  const session = async (token: string, title: string) => {
    const { data } = await fake.client(token).from('ask_sessions').insert({ title }).select('id').single() as { data: { id: string } };
    return data.id;
  };
  const ask = async (token: string, sessionId: string, text: string) => {
    clock.now += 1000;
    const { data } = await fake.client(token).from('ask_rounds').insert({ session_id: sessionId, questions: question(text) }).select('id').single() as { data: { id: string } };
    return data.id;
  };
  return Promise.resolve({ clock, as, session, ask });
}

describe('the Questions part, read from the database', () => {
  it('holds my own open rounds and the ones shared with me, oldest first, each with its first question', async () => {
    const w = await world();
    const mine = await w.session('bob', 'vertuo-omni-loop · feat/bob');
    const adas = await w.session('ada', 'vertuo-omni-loop · feat/ada');
    const own = await w.ask('bob', mine, 'Which storage?');
    const shared = await w.ask('ada', adas, 'Which colour?');
    await shareRound(w.as('ada'), shared, BOB.id);
    const read = waitingReads(w.as('bob')).questionsReader(BOB.id);
    expect(await read(w.clock.now)).toEqual([
      { kind: 'question', id: own, sessionTitle: 'vertuo-omni-loop · feat/bob', question: 'Which storage?', askedAt: START + 1000, sharedBy: null },
      { kind: 'question', id: shared, sessionTitle: 'vertuo-omni-loop · feat/ada', question: 'Which colour?', askedAt: START + 2000, sharedBy: 'Ada', sharedByFace: { kind: 'initial', letter: 'A' } },
    ]);
  });

  it('drops a round once it is answered', async () => {
    const w = await world();
    const mine = await w.session('bob', 'feat/bob');
    const own = await w.ask('bob', mine, 'Which storage?');
    const read = waitingReads(w.as('bob')).questionsReader(BOB.id);
    expect(await read(w.clock.now)).toHaveLength(1);
    await sendAnswers(w.as('bob'), own, { 'Which storage?': 'Yes' });
    expect(await read(w.clock.now)).toEqual([]);
  });

  it('holds nothing for someone with no session and nothing shared', async () => {
    const w = await world();
    expect(await waitingReads(w.as('ada')).questionsReader(ADA.id)(w.clock.now)).toEqual([]);
  });
});

// The New documents part (PRD 579, s1), read on the server since PRD 1318 (s4): the versions of the
// numbered dossiers the person opened, from the last 7 days, the 50 newest, of the three kinds shown.

const NOW = Date.parse('2026-09-29T10:00:00Z');
const MIN = 60_000;
const at = (ms: number) => new Date(ms).toISOString();
const version = (id: string, kind: string, prd: number | null = 572) => ({ id, kind, created_at: at(NOW - MIN), dossier: { id: `d-${prd}`, prd, title: `PRD title ${prd}` } });

/** A fake client that records the query built on it and answers `result`. */
function recording(result: { data: unknown; error: { message: string } | null }) {
  const calls: [string, ...unknown[]][] = [];
  const chain: Record<string, unknown> = {};
  for (const name of ['select', 'eq', 'not', 'gt', 'gte', 'order', 'limit']) {
    chain[name] = (...args: unknown[]) => {
      calls.push([name, ...args]);
      return chain;
    };
  }
  chain.then = (ok: (r: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(result).then(ok, ko);
  const db = { from: (table: string) => { calls.push(['from', table]); return chain; } } as unknown as WaitingDb;
  return { db, calls };
}

describe('the New documents part, read on the server', () => {
  it('reads the versions of the numbered dossiers I opened, from the last 7 days, the 50 newest', async () => {
    const rows = [version('v1', 'spec')];
    const { db, calls } = recording({ data: rows, error: null });
    expect(await waitingReads(db).documents('me-1', NOW)).toEqual(rows);
    expect(DOCS_DAYS).toBe(7);
    expect(DOCS_LIMIT).toBe(50);
    expect(calls).toContainEqual(['from', 'dossier_versions']);
    const select = calls.find((c) => c[0] === 'select')?.[1] as string;
    expect(select.replace(/\s+/g, '')).toBe('id,kind,created_at,dossier:dossiers!inner(id,prd,title,opened_by)');
    expect(calls).toContainEqual(['eq', 'dossier.opened_by', 'me-1']);
    expect(calls).toContainEqual(['not', 'dossier.prd', 'is', null]);
    expect(calls).toContainEqual(['gt', 'created_at', at(NOW - 7 * 24 * 60 * MIN)]);
    expect(calls).toContainEqual(['order', 'created_at', { ascending: false }]);
    expect(calls).toContainEqual(['limit', 50]);
  });

  it('keeps only the kinds it knows, of numbered dossiers, and reads none as empty', async () => {
    const rows = [version('v1', 'retro'), version('v2', 'plan', null), { ...version('v3', 'spec'), dossier: null }, version('v4', 'before-after')];
    expect(await waitingReads(recording({ data: rows, error: null }).db).documents('me-1', NOW)).toEqual([version('v4', 'before-after')]);
    expect(await waitingReads(recording({ data: null, error: null }).db).documents('me-1', NOW)).toEqual([]);
  });

  it('throws when the read fails', async () => {
    await expect(waitingReads(recording({ data: null, error: { message: 'denied' } }).db).documents('me-1', NOW)).rejects.toThrow(/denied/);
  });
});
