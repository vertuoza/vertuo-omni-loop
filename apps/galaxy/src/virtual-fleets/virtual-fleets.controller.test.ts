import { describe, expect, it } from 'vitest';
import { postVirtualFleet, type VirtualFleetsDeps } from './virtual-fleets.controller';
import { ADA, BEN, DAN, fakeVirtualFleetsDb, NORTHWIND } from './virtual-fleets.fake';
import { FAILED, ONLY_MEMBERS, virtualFleetsService } from './virtual-fleets.service';

// POST /api/virtual-fleets (PRD 2842 s1), with the real service on the database in memory: any member
// makes a Virtual Fleet with a hero per role left on and is answered the fleet; each refusal names the
// drawer's field it goes under.

const ALL = ['engineer', 'qa', 'reviewer', 'pm', 'architect'];

function deps(person: string | null, db = fakeVirtualFleetsDb()) {
  const lines: string[] = [];
  const given: VirtualFleetsDeps = {
    service: () => Promise.resolve(person === null ? null : virtualFleetsService(db.as(person))),
    log: (line) => { lines.push(line); },
  };
  return { deps: given, db, lines };
}

const post = (body: unknown) => new Request('http://local/api/virtual-fleets', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) });
const create = (more: Record<string, unknown> = {}) => post({ workspace: NORTHWIND, name: 'Night Shift', mascot: 'robot', roles: ALL, ...more });

describe('POST /api/virtual-fleets', () => {
  it('makes a member\'s fleet with a hero per role left on, its key from its name and the first free colour', async () => {
    const { deps: given, db } = deps(ADA);
    const res = await postVirtualFleet(create({ roles: ['qa', 'engineer'] }), given);
    expect(res.status).toBe(201);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ fleet: { name: 'night-shift', label: 'Night Shift', color: '#b07cff', mascot: 'robot' } });
    const made = db.teams.get(NORTHWIND)?.find((t) => t.name === 'night-shift');
    expect(made?.kind).toBe('virtual');
    expect(made?.heroes.map((h) => [h.role, h.name])).toEqual([['qa', 'QA'], ['engineer', 'Engineer']]);
    expect(made?.heroes.find((h) => h.role === 'engineer')?.skills).toEqual(['yolo', 'yolo-fix', 'wave', 'do-work', 'pr-care', 'bug-fix']);
  });

  it('refuses a name already used in the workspace under the Name field', async () => {
    const res = await postVirtualFleet(create({ name: 'Beaver' }), deps(ADA).deps);
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'Name taken: choose another', field: 'name' });
  });

  it('refuses an icon the database does not list under the Icon field', async () => {
    const res = await postVirtualFleet(create({ mascot: 'dragon' }), deps(ADA).deps);
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'Icon: one of beaver, octopod, robot.', field: 'mascot' });
  });

  it('refuses a body with no role on, or a role it does not know, under Heroes, before the database is asked', async () => {
    for (const roles of [[], ['designer']]) {
      const res = await postVirtualFleet(create({ roles }), deps(ADA).deps);
      expect(res.status).toBe(422);
      expect(await res.json()).toMatchObject({ field: 'heroes' });
    }
  });

  it('refuses an empty or a long name under Name, and a body that is no object', async () => {
    for (const name of ['   ', 'Thirteen char']) {
      const res = await postVirtualFleet(create({ name }), deps(ADA).deps);
      expect(res.status).toBe(422);
      expect(await res.json()).toMatchObject({ field: 'name' });
    }
    for (const body of ['not json', '[]', 'null']) expect((await postVirtualFleet(post(body), deps(ADA).deps)).status).toBe(400);
    expect((await postVirtualFleet(create({ workspace: 'nope' }), deps(ADA).deps)).status).toBe(422);
  });

  it('refuses someone outside the workspace with 403, and makes nothing', async () => {
    const { deps: given, db } = deps(DAN);
    const res = await postVirtualFleet(create(), given);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: ONLY_MEMBERS, field: 'form' });
    expect(db.teams.get(NORTHWIND)?.map((t) => t.name)).toEqual(['beaver']);
  });

  it('answers 401 signed out and 503 with no database, reading no body', async () => {
    const signedOut = await postVirtualFleet(create(), deps(null).deps);
    expect(signedOut.status).toBe(401);
    const none = await postVirtualFleet(create(), { service: null, log: () => undefined });
    expect(none.status).toBe(503);
  });

  it('answers 500 and logs the cause when the database fails', async () => {
    const lines: string[] = [];
    const broken: VirtualFleetsDeps = {
      service: () => Promise.resolve(virtualFleetsService({
        create: () => Promise.resolve({ ok: false, code: '23505', hint: null, message: 'duplicate key' }),
        names: () => Promise.resolve([]),
      })),
      log: (line) => { lines.push(line); },
    };
    const res = await postVirtualFleet(create(), broken);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: FAILED, field: 'form' });
    expect(lines).toEqual(['virtual-fleets: 23505: duplicate key']);

    const thrown = await postVirtualFleet(create(), { service: () => Promise.reject(new Error('down')), log: (line) => { lines.push(line); } });
    expect(thrown.status).toBe(500);
    expect(lines.at(-1)).toBe('virtual-fleets: down');
  });

  it('puts the cap of 12 active fleets in the drawer\'s foot', async () => {
    const service = virtualFleetsService({
      create: () => Promise.resolve({ ok: false, code: '22023', hint: 'fleets', message: 'Fleets: at most 12 active. Retire one first.' }),
      names: () => Promise.resolve([]),
    });
    const res = await postVirtualFleet(create(), { service: () => Promise.resolve(service), log: () => undefined });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'Fleets: at most 12 active. Retire one first.', field: 'form' });
  });
});

describe('the virtual fleets a member reads', () => {
  it('lists the keys of the workspace\'s virtual fleets, none for an outsider', async () => {
    const db = fakeVirtualFleetsDb();
    await virtualFleetsService(db.as(ADA)).create({ workspace: NORTHWIND, name: 'Night Shift', mascot: 'robot', roles: ['engineer'] });
    expect(await virtualFleetsService(db.as(ADA)).names(NORTHWIND)).toEqual(['night-shift']);
    expect(await virtualFleetsService(db.as(BEN)).names(NORTHWIND)).toEqual(['night-shift']);
    expect(await virtualFleetsService(db.as(DAN)).names(NORTHWIND)).toEqual([]);
  });
});
