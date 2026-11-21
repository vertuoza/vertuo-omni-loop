import { describe, expect, it } from 'vitest';
import { postCommanderNote, type CommanderDeps } from './commander.controller';
import { commanderService } from './commander.service';
import { fakeCommanderDb, GUS, MIRA, NO_RAIL, NORTHWIND, NOW } from './commander.fake';

// POST /api/virtual-fleets/commander/notes (PRD 3107 s4), with the real service on the fake database: a member deletes a line
// of their fleet's notebooks, as themselves, and the answer says who and when (AC-8); signed out 401, no database 503, a
// malformed body 400, a body that is no line's id 422, a stranger 403, a line of no notebook of this fleet 404.

const LINE = 'dddddddd-0000-4000-8000-000000000001';
const remove = (body: unknown) => new Request('https://omni.test/api/virtual-fleets/commander/notes', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body),
});
const BODY = { workspace: NORTHWIND, fleet: 'blue-fleet', note: LINE };

function deps(person: string | null): CommanderDeps {
  const db = fakeCommanderDb();
  db.notes.push({ workspace: NORTHWIND, fleet: 'blue-fleet', id: LINE, notebook: 'fleet', mission: 'aaaaaaaa-0000-4000-8000-000000003110', day: '2026-11-20', line: 'PRD 2817 waited one day.', events: ['aaaaaaaa-0000-4000-8000-0000000e0001'], createdAt: '2026-11-21T00:01:00Z', deleted: null });
  return {
    service: () => Promise.resolve(person === null ? null : commanderService({ reader: db.as(person), writer: null, model: null, rail: NO_RAIL, me: person, now: () => NOW })),
    log: () => undefined,
  };
}

describe('POST /api/virtual-fleets/commander/notes', () => {
  it('AC-8: deletes a line as the member, and says who and when', async () => {
    const res = await postCommanderNote(remove(BODY), deps(MIRA));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ note: { id: LINE, at: NOW.toISOString(), login: MIRA } });
  });

  it('refuses the signed-out, a malformed body, a body that is no line\'s id, a stranger and a line of no notebook of the fleet', async () => {
    expect((await postCommanderNote(remove(BODY), deps(null))).status).toBe(401);
    expect((await postCommanderNote(remove(BODY), { service: null, log: () => undefined })).status).toBe(503);
    expect((await postCommanderNote(remove('not json'), deps(MIRA))).status).toBe(400);
    expect((await postCommanderNote(remove({ ...BODY, note: 'line-1' }), deps(MIRA))).status).toBe(422);
    expect((await postCommanderNote(remove(BODY), deps(GUS))).status).toBe(403);
    expect((await postCommanderNote(remove({ ...BODY, note: 'dddddddd-0000-4000-8000-000000000099' }), deps(MIRA))).status).toBe(404);
  });
});
