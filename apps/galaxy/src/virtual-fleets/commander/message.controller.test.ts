import { describe, expect, it } from 'vitest';
import { postCommanderMessage, type CommanderDeps } from './commander.controller';
import { commanderService } from './commander.service';
import { fakeCommanderDb, fakeModel, NO_RAIL, GUS, MIRA, NORTHWIND, NOW } from './commander.fake';

// POST /api/virtual-fleets/commander/message (PRD 3107 s3), with the real service on the fake database: a member's message
// is stored, tagged for the fleet and read by no job yet, with no model asked (AC-5); signed out 401, no database 503, a
// malformed body 400, an empty text or a fleet that is not virtual 422, a stranger 403.

const send = (body: unknown) => new Request('https://omni.test/api/virtual-fleets/commander/message', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body),
});
const MESSAGE = { workspace: NORTHWIND, fleet: 'blue-fleet', text: 'the design review moved to Thursday' };

function deps(person: string | null, model = true): CommanderDeps {
  const db = fakeCommanderDb();
  return {
    service: () => Promise.resolve(person === null ? null : commanderService({ reader: db.as(person), writer: db.writer(), model: model ? fakeModel([]).model : null, rail: NO_RAIL, me: person, now: () => NOW })),
    log: () => undefined,
  };
}

describe('POST /api/virtual-fleets/commander/message', () => {
  it('AC-5: stores a member\'s message, tagged for the fleet and read by no job yet, with no model asked', async () => {
    const res = await postCommanderMessage(send(MESSAGE), deps(MIRA, false));
    expect(res.status).toBe(201);
    const body = (await res.json()) as { message: unknown };
    expect(body.message).toMatchObject({ kind: 'fleet', login: MIRA, text: MESSAGE.text, reads: [] });
  });

  it('refuses the signed-out, a malformed body, an empty text, a stranger and a fleet that is not virtual', async () => {
    expect((await postCommanderMessage(send(MESSAGE), deps(null))).status).toBe(401);
    expect((await postCommanderMessage(send(MESSAGE), { service: null, log: () => undefined })).status).toBe(503);
    expect((await postCommanderMessage(send('not json'), deps(MIRA))).status).toBe(400);
    expect((await postCommanderMessage(send({ ...MESSAGE, text: '  ' }), deps(MIRA))).status).toBe(422);
    expect((await postCommanderMessage(send(MESSAGE), deps(GUS))).status).toBe(403);
    expect((await postCommanderMessage(send({ ...MESSAGE, fleet: 'beaver' }), deps(MIRA))).status).toBe(422);
  });
});
