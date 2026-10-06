import { describe, expect, it } from 'vitest';
import { fakeSupabase } from '../ask/store.fake';
import { sendAnswers, shareRound, type Db, type SortDb } from '../ask/page/source';
import { questionsReader } from './source';

// The Questions part read from the database as the signed-in person (PRD 499), on the ask pages' fake
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
    const read = questionsReader(w.as('bob'), BOB.id);
    expect(await read(w.clock.now)).toEqual([
      { kind: 'question', id: own, sessionTitle: 'vertuo-omni-loop · feat/bob', question: 'Which storage?', askedAt: START + 1000, sharedBy: null },
      { kind: 'question', id: shared, sessionTitle: 'vertuo-omni-loop · feat/ada', question: 'Which colour?', askedAt: START + 2000, sharedBy: 'Ada', sharedByFace: { kind: 'initial', letter: 'A' } },
    ]);
  });

  it('drops a round once it is answered', async () => {
    const w = await world();
    const mine = await w.session('bob', 'feat/bob');
    const own = await w.ask('bob', mine, 'Which storage?');
    const read = questionsReader(w.as('bob'), BOB.id);
    expect(await read(w.clock.now)).toHaveLength(1);
    await sendAnswers(w.as('bob'), own, { 'Which storage?': 'Yes' });
    expect(await read(w.clock.now)).toEqual([]);
  });

  it('holds nothing for someone with no session and nothing shared', async () => {
    const w = await world();
    expect(await questionsReader(w.as('ada'), ADA.id)(w.clock.now)).toEqual([]);
  });
});
