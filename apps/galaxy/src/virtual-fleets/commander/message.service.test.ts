import { describe, expect, it } from 'vitest';
import { commanderService } from './commander.service';
import { fakeCommanderDb, fakeModel, GUS, MIRA, NO_RAIL, NORTHWIND, NOW } from './commander.fake';

// A member's message to the fleet (PRD 3107 s3) over the fake database: stored signed by its author and tagged for the
// fleet, a `messaged` event in each running mission and none elsewhere, holding none of its words (AC-5); refused for a
// stranger, an empty or long text and a fleet that is no AI Fleet; sent with the Commander off or out of tokens,
// since no model reads it; and read back in the thread beside the questions.

const SEND = { workspace: NORTHWIND, fleet: 'blue-fleet', text: 'the design review moved to Thursday' };

function setup(person = MIRA, options: { model?: boolean } = {}) {
  const db = fakeCommanderDb();
  const service = commanderService({ reader: db.as(person), writer: db.writer(), model: options.model === false ? null : fakeModel([]).model, rail: NO_RAIL, me: person, now: () => NOW });
  return { db, service };
}

describe('messaging the fleet', () => {
  it('AC-5: stores the message signed by its author, waiting for a job, and adds a messaged event to each running mission, holding none of its words', async () => {
    const { db, service } = setup();
    db.missions.push({ workspace: NORTHWIND, fleet: 'blue-fleet', id: 'aaaaaaaa-0000-4000-8000-000000003111', number: 3111, title: 'Second', status: 'running', waitingOn: null, repo: 'northwind/quotes', updatedAt: '2026-11-21T08:50:00Z' });
    const served = await service.send(SEND);
    if (!served.ok) throw new Error(served.error);
    expect(served.value).toMatchObject({ kind: 'fleet', login: MIRA, text: SEND.text, reads: [] });
    expect(db.told).toHaveLength(1);
    const events = db.events.filter((e) => e.kind === 'messaged');
    expect(events.map((e) => e.mission)).toEqual(['aaaaaaaa-0000-4000-8000-000000003111']);
    expect(events.every((e) => !e.sentence.includes('Thursday') && e.role === 'supervisor')).toBe(true);
  });

  it('adds no event when no mission runs: the message is still kept', async () => {
    const { db, service } = setup();
    const served = await service.send(SEND);
    expect(served.ok).toBe(true);
    expect(db.told).toHaveLength(1);
    expect(db.events.filter((e) => e.kind === 'messaged')).toEqual([]);
  });

  it('shows it in the thread beside the questions, and never among the Commander\'s own messages', async () => {
    const { db, service } = setup();
    await service.send(SEND);
    const view = await service.view({ workspace: NORTHWIND, fleet: 'blue-fleet' });
    if (!view.ok) throw new Error(view.error);
    expect(view.value.messages.map((m) => m.kind)).toEqual(['fleet']);
    expect(db.messages).toEqual([]);
  });

  it('refuses a member of another workspace, an empty or long text and a fleet that is not virtual', async () => {
    expect(await setup(GUS).service.send(SEND)).toMatchObject({ ok: false, kind: 'forbidden' });
    expect(await setup().service.send({ ...SEND, text: '   ' })).toMatchObject({ ok: false, kind: 'invalid', error: 'Message: 1 to 2000 characters.' });
    expect(await setup().service.send({ ...SEND, text: 'x'.repeat(2001) })).toMatchObject({ ok: false, kind: 'invalid' });
    expect(await setup().service.send({ ...SEND, fleet: 'beaver' })).toMatchObject({ ok: false, kind: 'invalid', error: 'Fleet: only a AI Fleet has a Commander.' });
  });

  it('needs no model: with the Commander off, it is sent', async () => {
    const { db, service } = setup(MIRA, { model: false });
    expect((await service.send(SEND)).ok).toBe(true);
    expect(db.told).toHaveLength(1);
  });

  it('answers a database refusal it did not foresee as not sent, its cause kept for the log', async () => {
    const db = fakeCommanderDb();
    const reader = { ...db.as(MIRA), send: () => Promise.resolve({ ok: false as const, code: 'XX000', hint: null, message: 'boom' }) };
    const service = commanderService({ reader, writer: db.writer(), model: null, rail: NO_RAIL, me: MIRA, now: () => NOW });
    expect(await service.send(SEND)).toEqual({ ok: false, kind: 'not-sent', error: 'Not sent: try again.', cause: 'XX000: boom' });
  });
});
