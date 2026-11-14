import { describe, expect, it } from 'vitest';
import { deleteHero, postHero, type HeroesDeps } from './heroes.controller';
import { ADA, BEN, ENGINEER_ID, fakeHeroesDb, NORTHWIND, QA_ID } from './heroes.fake';
import { FAILED, heroesService, ONLY_OWNERS } from './heroes.service';

// POST and DELETE /api/virtual-fleets/heroes (PRD 2842 s6), with the real service on the database in
// memory: an owner adds a hero of a role the fleet lacks, with its role's defaults, and removes one but a
// fleet's last; a member, nobody else; each refusal names the field it belongs to.

function deps(person: string | null, db = fakeHeroesDb()) {
  const lines: string[] = [];
  const given: HeroesDeps = {
    service: () => Promise.resolve(person === null ? null : heroesService(db.as(person))),
    log: (line) => { lines.push(line); },
  };
  return { deps: given, db, lines };
}

const send = (method: 'POST' | 'DELETE', body: unknown) => new Request('http://local/api/virtual-fleets/heroes', { method, body: typeof body === 'string' ? body : JSON.stringify(body) });
const add = (more: Record<string, unknown> = {}) => send('POST', { workspace: NORTHWIND, fleet: 'night-shift', role: 'pm', ...more });
const remove = (more: Record<string, unknown> = {}) => send('DELETE', { workspace: NORTHWIND, hero: QA_ID, ...more });

describe('POST /api/virtual-fleets/heroes', () => {
  it('adds the hero of a role the fleet lacks, with its role\'s defaults, after the others', async () => {
    const { deps: given, db } = deps(ADA);
    const res = await postHero(add({ role: 'architect' }), given);
    expect(res.status).toBe(201);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = (await res.json()) as { hero: { role: string; name: string; skills: string[]; position: number } };
    expect(body.hero).toMatchObject({ role: 'architect', name: 'Architect', skills: ['plan'], position: 2 });
    expect(db.heroes.map((h) => h.role)).toEqual(['engineer', 'qa', 'architect']);
  });

  it('refuses a role the fleet already has under the Role field', async () => {
    const res = await postHero(add({ role: 'qa' }), deps(ADA).deps);
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'Role: this fleet already has that hero.', field: 'role' });
  });

  it('refuses a fleet that is not a virtual fleet of the workspace in the foot', async () => {
    const res = await postHero(add({ fleet: 'beaver' }), deps(ADA).deps);
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'Fleet: not a virtual fleet of this workspace.', field: 'form' });
  });

  it('refuses a member who is no owner, and changes nothing', async () => {
    const { deps: given, db } = deps(BEN);
    const res = await postHero(add(), given);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: ONLY_OWNERS, field: 'form' });
    expect(db.heroes).toHaveLength(2);
  });

  it('refuses a body with an unknown role under Role, and one that is not an object as malformed', async () => {
    const wrong = await postHero(add({ role: 'designer' }), deps(ADA).deps);
    expect(wrong.status).toBe(422);
    expect(((await wrong.json()) as { field: string }).field).toBe('role');
    const nothing = await postHero(add({ workspace: 'x' }), deps(ADA).deps);
    expect(((await nothing.json()) as { field: string }).field).toBe('form');
    for (const body of ['[]', 'null', 'not json', 'x'.repeat(5000)]) {
      const res = await postHero(send('POST', body), deps(ADA).deps);
      expect(res.status).toBe(400);
    }
  });

  it('answers 401 signed out and 503 with no database, before anything else runs', async () => {
    expect((await postHero(add(), deps(null).deps)).status).toBe(401);
    const none: HeroesDeps = { service: null, log: () => undefined };
    const res = await postHero(add(), none);
    expect(res.status).toBe(503);
    expect(((await res.json()) as { error: string }).error).toMatch(/no database/);
  });

  it('logs a failure and answers 500 in plain words', async () => {
    const lines: string[] = [];
    const broken: HeroesDeps = { service: () => Promise.reject(new Error('down')), log: (line) => { lines.push(line); } };
    const res = await postHero(add(), broken);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: FAILED, field: 'form' });
    expect(lines).toEqual(['virtual-fleets/heroes: down']);
  });

  it('logs an unforeseen refusal of the database, never its words to the person', async () => {
    const db = fakeHeroesDb();
    const lines: string[] = [];
    const repository = { ...db.as(ADA), add: () => Promise.resolve({ ok: false as const, code: 'XX000', hint: null, message: 'boom' }) };
    const res = await postHero(add(), { service: () => Promise.resolve(heroesService(repository)), log: (line) => { lines.push(line); } });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: FAILED, field: 'form' });
    expect(lines).toEqual(['virtual-fleets/heroes: XX000: boom']);
  });
});

describe('DELETE /api/virtual-fleets/heroes', () => {
  it('removes a hero and answers its id', async () => {
    const { deps: given, db } = deps(ADA);
    const res = await deleteHero(remove(), given);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ removed: QA_ID });
    expect(db.heroes.map((h) => h.role)).toEqual(['engineer']);
  });

  it('never removes a fleet\'s last hero', async () => {
    const { deps: given, db } = deps(ADA);
    await deleteHero(remove(), given);
    const res = await deleteHero(remove({ hero: ENGINEER_ID }), given);
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'Hero: a fleet keeps at least one hero.', field: 'hero' });
    expect(db.heroes).toHaveLength(1);
  });

  it('refuses a member who is no owner, and a hero that is none', async () => {
    const member = await deleteHero(remove(), deps(BEN).deps);
    expect(member.status).toBe(403);
    const none = await deleteHero(remove({ hero: '44444444-4444-4444-8444-444444444444' }), deps(ADA).deps);
    expect(none.status).toBe(422);
    expect(((await none.json()) as { field: string }).field).toBe('hero');
  });

  it('refuses a body with no hero id under Hero, a broken one as malformed, and answers 401 signed out', async () => {
    const wrong = await deleteHero(remove({ hero: 'x' }), deps(ADA).deps);
    expect(wrong.status).toBe(422);
    expect(((await wrong.json()) as { field: string }).field).toBe('hero');
    const form = await deleteHero(remove({ workspace: 'x' }), deps(ADA).deps);
    expect(((await form.json()) as { field: string }).field).toBe('form');
    expect((await deleteHero(send('DELETE', 'nope'), deps(ADA).deps)).status).toBe(400);
    expect((await deleteHero(remove(), deps(null).deps)).status).toBe(401);
  });
});
