import { describe, expect, it } from 'vitest';
import { commanderService } from './commander.service';
import { fakeCommanderDb, fakeModel, GUS, MIRA, NO_RAIL, NORTHWIND, NOW, PAUL, replied } from './commander.fake';
import type { ModelAnswer } from './model';

// The two notebooks in the Commander (PRD 3107 s4) over the fake database: the tab carries the fleet notebook, then each
// mission's, with how many lines; a question reads the fleet notebook's lines that are not deleted and can cite one (AC-7);
// a member deletes a line as themselves, the record keeping who and when, and the Commander reads it no more (AC-8); a
// stranger deletes nothing, and a line of another fleet is no line of this one.

const MISSION_3110 = 'aaaaaaaa-0000-4000-8000-000000003110';
const MISSION_3098 = 'aaaaaaaa-0000-4000-8000-000000003098';
const EVENT = 'aaaaaaaa-0000-4000-8000-0000000e0001';
const FLEET_LINE = 'dddddddd-0000-4000-8000-000000000001';
const MISSION_LINE = 'dddddddd-0000-4000-8000-000000000002';
const ENDED_LINE = 'dddddddd-0000-4000-8000-000000000003';
const ASK = { workspace: NORTHWIND, fleet: 'blue-fleet', text: 'What did the last mission teach us?' };

function setup(person = MIRA, answers: readonly ModelAnswer[] = []) {
  const db = fakeCommanderDb();
  db.missions.push({ workspace: NORTHWIND, fleet: 'blue-fleet', id: MISSION_3098, number: 3098, title: 'Invoices', status: 'delivered', waitingOn: null, repo: 'northwind/quotes', updatedAt: '2026-11-19T10:00:00Z' });
  db.notes.push(
    { workspace: NORTHWIND, fleet: 'blue-fleet', id: FLEET_LINE, notebook: 'fleet', mission: MISSION_3098, day: '2026-11-19', line: 'The e2e suite timed out on the quotes page.', events: [EVENT, 'aaaaaaaa-0000-4000-8000-0000000e0002'], createdAt: '2026-11-20T00:01:00Z', deleted: null },
    { workspace: NORTHWIND, fleet: 'blue-fleet', id: MISSION_LINE, notebook: 'mission', mission: MISSION_3110, day: '2026-11-20', line: 'PRD 2817 waited one day.', events: [EVENT], createdAt: '2026-11-21T00:01:00Z', deleted: null },
    { workspace: NORTHWIND, fleet: 'blue-fleet', id: ENDED_LINE, notebook: 'mission', mission: MISSION_3098, day: '2026-11-18', line: 'Invoices shipped.', events: [EVENT], createdAt: '2026-11-19T00:01:00Z', deleted: null },
  );
  const fake = fakeModel(answers);
  const service = commanderService({ reader: db.as(person), writer: db.writer(), model: fake.model, rail: NO_RAIL, me: person, now: () => NOW });
  return { db, fake, service };
}

describe('the notebooks in the Commander tab', () => {
  it('carries the fleet notebook, then each mission\'s, the running ones first, and how many lines in all', async () => {
    const view = await setup().service.view({ workspace: NORTHWIND, fleet: 'blue-fleet' });
    if (!view.ok) throw new Error(view.error);
    expect(view.value.notebooks).toEqual({
      fleet: [{ id: FLEET_LINE, day: '2026-11-19', line: 'The e2e suite timed out on the quotes page.', events: 2, href: `/app/ai-fleet?fleet=blue-fleet&tab=room&mission=${MISSION_3098}` }],
      missions: [
        { mission: MISSION_3110, number: 3110, title: 'Quotes export', status: 'waiting', lines: [{ id: MISSION_LINE, day: '2026-11-20', line: 'PRD 2817 waited one day.', events: 1, href: `/app/ai-fleet?fleet=blue-fleet&tab=room&mission=${MISSION_3110}` }] },
        { mission: MISSION_3098, number: 3098, title: 'Invoices', status: 'delivered', lines: [{ id: ENDED_LINE, day: '2026-11-18', line: 'Invoices shipped.', events: 1, href: `/app/ai-fleet?fleet=blue-fleet&tab=room&mission=${MISSION_3098}` }] },
      ],
      count: 3,
    });
  });

  it('AC-7: a question reads the fleet notebook\'s lines, as data, and a claim may cite one', async () => {
    const { fake, service } = setup(MIRA, [replied({ verdict: 'The e2e suite timed out.', claims: [{ text: 'The quotes page timed out in the last mission.', refs: ['n1'] }] })]);
    const served = await service.ask(ASK);
    if (!served.ok || served.value.reply.kind !== 'reply') throw new Error('no reply');
    const data = fake.turns[0]?.data ?? '';
    expect(data).toContain('notebooks, newest first (ref | notebook | day | line):\nn1 | fleet | 2026-11-19 | The e2e suite timed out on the quotes page.\nn2 | mission 3110 | 2026-11-20 | PRD 2817 waited one day.');
    expect(data.indexOf('n1 | fleet')).toBeLessThan(data.indexOf('</fleet_record>'));
    expect(served.value.reply.reply.claims[0]?.sources).toEqual([
      { label: 'note 11-19', href: `/app/ai-fleet?fleet=blue-fleet&tab=room&mission=${MISSION_3098}`, line: '2026-11-19 · The e2e suite timed out on the quotes page.' },
    ]);
  });

  it('AC-8: a member deletes a line as themselves; the record says who and when, and the Commander no longer reads it', async () => {
    const { db, fake, service } = setup(PAUL, [replied({ verdict: null, claims: [] })]);
    expect(await service.deleteNote({ workspace: NORTHWIND, fleet: 'blue-fleet', note: FLEET_LINE })).toEqual({ ok: true, value: { id: FLEET_LINE, at: NOW.toISOString(), login: PAUL } });
    expect(db.notes.find((n) => n.id === FLEET_LINE)?.deleted).toEqual({ login: PAUL, at: NOW.toISOString() });
    await service.ask(ASK);
    expect(fake.turns[0]?.data).not.toContain('The e2e suite timed out on the quotes page.');
    const view = await service.view({ workspace: NORTHWIND, fleet: 'blue-fleet' });
    if (!view.ok) throw new Error(view.error);
    expect(view.value.notebooks.fleet).toEqual([]);
    expect(view.value.notebooks.count).toBe(2);
  });

  it('needs no model: with the Commander off, a line is deleted', async () => {
    const db = fakeCommanderDb();
    db.notes.push({ workspace: NORTHWIND, fleet: 'blue-fleet', id: FLEET_LINE, notebook: 'fleet', mission: MISSION_3110, day: '2026-11-19', line: 'A line.', events: [EVENT], createdAt: '2026-11-20T00:01:00Z', deleted: null });
    const service = commanderService({ reader: db.as(MIRA), writer: null, model: null, rail: NO_RAIL, me: MIRA, now: () => NOW });
    expect((await service.deleteNote({ workspace: NORTHWIND, fleet: 'blue-fleet', note: FLEET_LINE })).ok).toBe(true);
  });

  it('refuses a stranger, a fleet that is not virtual, and a line that is not of this fleet', async () => {
    expect(await setup(GUS).service.deleteNote({ workspace: NORTHWIND, fleet: 'blue-fleet', note: FLEET_LINE })).toMatchObject({ ok: false, kind: 'forbidden' });
    expect(await setup().service.deleteNote({ workspace: NORTHWIND, fleet: 'beaver', note: FLEET_LINE })).toMatchObject({ ok: false, kind: 'invalid' });
    expect(await setup().service.deleteNote({ workspace: NORTHWIND, fleet: 'blue-fleet', note: 'dddddddd-0000-4000-8000-000000000099' })).toMatchObject({ ok: false, kind: 'missing' });
    const { db } = setup();
    expect(db.notes.every((n) => n.deleted === null)).toBe(true);
  });

  it('answers a database refusal it did not foresee as not deleted, its cause kept for the log', async () => {
    const { db } = setup();
    const reader = { ...db.as(MIRA), deleteNote: () => Promise.resolve({ ok: false as const, code: 'XX000', hint: null, message: 'boom' }) };
    const service = commanderService({ reader, writer: null, model: null, rail: NO_RAIL, me: MIRA, now: () => NOW });
    expect(await service.deleteNote({ workspace: NORTHWIND, fleet: 'blue-fleet', note: FLEET_LINE })).toEqual({ ok: false, kind: 'database', error: 'Not deleted: try again.', cause: 'XX000: boom' });
  });
});
