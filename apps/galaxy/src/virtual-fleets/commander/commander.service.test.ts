import { describe, expect, it } from 'vitest';
import { commanderService, NOT_VIRTUAL, ONLY_MEMBERS } from './commander.service';
import { fakeCommanderDb, fakeModel, NO_RAIL, GLOBEX, GUS, MIRA, NORTHWIND, NOW, PAUL, replied } from './commander.fake';
import type { ModelAnswer } from './model';

// The Commander's rules (PRD 3107 s1) over the fake database and a fake model: a reply signed by no person whose every
// kept sentence links to a record of this fleet, built by the app (AC-1, AC-2); a context holding nothing of another
// workspace (AC-3); a stranger refused (AC-9); no model call once the fleet's tokens are used up (AC-10), nor with no
// model key (AC-11); a failed call keeps the question with no answer.

const ASK = { workspace: NORTHWIND, fleet: 'blue-fleet', text: 'What is PRD 2817 waiting for?' };

function setup(person = MIRA, answers: readonly (ModelAnswer | { tool: string; args: unknown })[] = [], options: { model?: boolean; writer?: boolean } = {}) {
  const db = fakeCommanderDb();
  const fake = fakeModel(answers);
  const service = commanderService({ reader: db.as(person), writer: options.writer === false ? null : db.writer(), model: options.model === false ? null : fake.model, rail: NO_RAIL, me: person, now: () => NOW });
  return { db, fake, service };
}

describe('asking the Commander', () => {
  it('AC-1: answers a member with a reply signed by no person, every kept sentence linked to a record of its fleet', async () => {
    const { db, fake, service } = setup(MIRA, [replied({ verdict: 'PRD 2817 waits on a review.', claims: [
      { text: 'PRD 2817 waits on its Reviewer.', refs: ['e1'] },
      { text: 'The Engineer made it ready.', refs: ['j1', 'p2817'] },
    ] }, 1500)]);
    const served = await service.ask(ASK);
    if (!served.ok) throw new Error(served.error);
    const { question, reply } = served.value;
    expect(question).toMatchObject({ kind: 'question', login: MIRA, text: ASK.text });
    if (reply.kind !== 'reply') throw new Error('no reply');
    expect(reply.replyTo).toBe(question.id);
    expect(reply.reply.verdict).toBe('PRD 2817 waits on a review.');
    expect(reply.reply.claims.map((c) => c.sources.map((s) => s.href))).toEqual([
      ['https://github.com/northwind/quotes/pull/2817'],
      ['/app/runners#job-4f2a1b2c-0000-4000-8000-000000000001', '/prd/at/northwind/quotes/2817?to=page'],
    ]);
    expect(reply.reply).toMatchObject({ read: 2, removed: 0 });
    expect(db.messages.at(-1)).toMatchObject({ kind: 'reply', workspace: NORTHWIND, fleet: 'blue-fleet', tokens: 1500 });
    expect(fake.turns[0]?.data).toContain('PRD 2817 waits on a review.');
  });

  it('AC-2: removes a claim citing a reference it was never given, and says so', async () => {
    const { service } = setup(MIRA, [replied({ verdict: 'One thing.', claims: [{ text: 'PRD 2817 waits.', refs: ['e1'] }, { text: 'PRD 2900 merged.', refs: ['e44'] }] })]);
    const served = await service.ask(ASK);
    if (!served.ok || served.value.reply.kind !== 'reply') throw new Error('no reply');
    expect(served.value.reply.reply.claims.map((c) => c.text)).toEqual(['PRD 2817 waits.']);
    expect(served.value.reply.reply.removed).toBe(1);
  });

  it('says it found nothing rather than that all is well, when nothing is kept', async () => {
    const { service } = setup(MIRA, [replied({ verdict: 'All is fine.', claims: [{ text: 'All is fine.', refs: [] }] })]);
    const served = await service.ask(ASK);
    if (!served.ok || served.value.reply.kind !== 'reply') throw new Error('no reply');
    expect(served.value.reply.reply).toMatchObject({ verdict: null, claims: [], removed: 1 });
  });

  it('AC-3: hands the model nothing of another workspace\'s fleet', async () => {
    const { fake, service } = setup(MIRA, [replied({ verdict: null, claims: [] })]);
    await service.ask(ASK);
    const data = fake.turns[0]?.data ?? '';
    expect(data).toContain('Quotes export');
    for (const foreign of ['Secret payroll rewrite', 'Globex payroll secret sentence.', '/omni:yolo 77', 'globex', 'red-fleet', '9001']) expect(data).not.toContain(foreign);
  });

  it('AC-3: reads older events through its tool only for a mission of this fleet', async () => {
    const { fake, service } = setup(MIRA, [
      { tool: 'older_events', args: { mission: 'm1' } }, { tool: 'older_events', args: { mission: 'm2' } }, { tool: 'drop_tables', args: {} },
      replied({ verdict: null, claims: [] }),
    ]);
    await service.ask(ASK);
    expect(fake.tools).toEqual(['No older event.', 'No mission m2 in this fleet\'s record.', 'No mission  in this fleet\'s record.']);
  });

  it('AC-9: refuses a member of another workspace, and keeps nothing of their question', async () => {
    const { db, fake, service } = setup(GUS, [replied({ verdict: null, claims: [] })]);
    expect(await service.ask(ASK)).toMatchObject({ ok: false, kind: 'forbidden', error: ONLY_MEMBERS });
    expect(await service.view({ workspace: NORTHWIND, fleet: 'blue-fleet' })).toMatchObject({ ok: false, kind: 'forbidden' });
    expect(db.messages).toHaveLength(0);
    expect(fake.turns).toHaveLength(0);
  });

  it('refuses a fleet that is not virtual', async () => {
    const { service } = setup(MIRA);
    expect(await service.ask({ ...ASK, fleet: 'beaver' })).toMatchObject({ ok: false, kind: 'invalid', error: NOT_VIRTUAL });
  });

  it('AC-10: makes no model call once the fleet\'s tokens are used up, and keeps no question', async () => {
    const { db, fake, service } = setup(MIRA, [replied({ verdict: null, claims: [] })]);
    db.spendJobs(1_000_000);
    expect(await service.ask(ASK)).toMatchObject({ ok: false, kind: 'used-up', error: 'Tokens used up. Back at 23:00 UTC.', state: { kind: 'used-up', backAt: '2026-11-21T23:00:00.000Z' } });
    expect(fake.turns).toHaveLength(0);
    expect(db.messages).toHaveLength(0);
  });

  it('counts its own replies toward the fleet\'s tokens', async () => {
    const { db, service } = setup(MIRA, [replied({ verdict: null, claims: [] }, 600)]);
    db.spendJobs(999_500);
    expect((await service.ask(ASK)).ok).toBe(true);
    const view = await service.view({ workspace: NORTHWIND, fleet: 'blue-fleet' });
    expect(view.ok && view.value.state.kind).toBe('used-up');
  });

  it('AC-11: is off with no model key, and keeps no question', async () => {
    const { db, service } = setup(MIRA, [], { model: false });
    expect(await service.ask(ASK)).toMatchObject({ ok: false, kind: 'off', error: 'The Commander is off: no model key.' });
    const view = await service.view({ workspace: NORTHWIND, fleet: 'blue-fleet' });
    expect(view.ok && view.value.state).toEqual({ kind: 'off' });
    expect(db.messages).toHaveLength(0);
  });

  it('keeps the question with no answer when the model fails or writes no reply of its shape', async () => {
    for (const answer of [{ ok: false as const, why: 'timeout', tokens: 0 }, { ok: true as const, content: 'All is fine.', tokens: 10 }]) {
      const { db, service } = setup(PAUL, [answer]);
      const served = await service.ask(ASK);
      expect(served).toMatchObject({ ok: false, kind: 'no-answer', error: 'No answer: try again.', question: { kind: 'question', login: PAUL } });
      expect(db.messages.map((m) => m.kind)).toEqual(['question']);
    }
  });

  it('is not available where it cannot keep its replies', async () => {
    const { service } = setup(MIRA, [], { writer: false });
    expect(await service.ask(ASK)).toMatchObject({ ok: false, kind: 'unavailable' });
  });

  it('turns the database\'s refusal of a question into its words, and anything unforeseen into a failure', async () => {
    const db = fakeCommanderDb();
    const fake = fakeModel([]);
    const refusing = (code: string, message: string) => commanderService({
      reader: { ...db.as(MIRA), ask: () => Promise.resolve({ ok: false, code, hint: null, message }) }, writer: db.writer(), model: fake.model, rail: NO_RAIL, me: MIRA, now: () => NOW,
    });
    expect(await refusing('42501', 'no').ask(ASK)).toMatchObject({ ok: false, kind: 'forbidden', error: ONLY_MEMBERS });
    expect(await refusing('22023', 'Question: 1 to 2000 characters.').ask(ASK)).toMatchObject({ ok: false, kind: 'invalid', error: 'Question: 1 to 2000 characters.' });
    expect(await refusing('XX000', 'disk full').ask(ASK)).toMatchObject({ ok: false, kind: 'database', cause: 'XX000: disk full' });
    expect(fake.turns).toHaveLength(0);
  });
});

describe('opening the Commander tab', () => {
  it('reads the state, the status line, the thread, the first visit\'s questions and what a question reads', async () => {
    const { service } = setup(MIRA);
    const view = await service.view({ workspace: NORTHWIND, fleet: 'blue-fleet' });
    expect(view).toEqual({
      ok: true,
      value: {
        workspace: NORTHWIND, fleet: 'blue-fleet', state: { kind: 'ready' },
        status: { running: 0, waiting: 1, paused: 0, spent: 0, cap: 1_000_000 },
        messages: [],
        suggestions: ['What waits on me?', 'What happened overnight?', 'Why did PRD 2809 stop?'],
        reading: { missions: 1, jobs: 1 },
        cards: [],
        me: MIRA,
      },
    });
  });

  it('shows the thread, oldest first, to every member', async () => {
    const asked = setup(MIRA, [replied({ verdict: 'Yes.', claims: [{ text: 'It waits.', refs: ['m1'] }] })]);
    await asked.service.ask(ASK);
    const paul = commanderService({ reader: asked.db.as(PAUL), writer: null, model: null, rail: NO_RAIL, me: PAUL, now: () => NOW });
    const view = await paul.view({ workspace: NORTHWIND, fleet: 'blue-fleet' });
    expect(view.ok && view.value.messages.map((m) => m.kind)).toEqual(['question', 'reply']);
    expect(view.ok && view.value.messages[0]).toMatchObject({ login: MIRA });
  });

  it('reads another workspace\'s fleet for its own members only', async () => {
    const gus = setup(GUS);
    const view = await gus.service.view({ workspace: GLOBEX, fleet: 'red-fleet' });
    expect(view.ok && view.value.status).toMatchObject({ running: 1, cap: null });
    expect(view.ok && view.value.suggestions).toEqual(['What waits on me?', 'What happened overnight?']);
  });
});
