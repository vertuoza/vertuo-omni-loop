import { describe, expect, it } from 'vitest';
import { makeRequest, readRequest, type RequestDeps } from './request.controller';
import { ADA, BEN, DAN, fakeRequestsDb, NORTHWIND } from './request.fake';
import { requestsService } from './request.service';

// The New mission box (PRD omni-loop-24 s3): POST /api/missions and GET /api/missions/requests/<id>, with the real service on the
// database in memory, whose rules are mission_request_make()'s as supabase/checks/missions.sql proves them.

function deps(person: typeof ADA | null, options: { failing?: boolean; bearer?: typeof ADA | null } = {}) {
  const db = fakeRequestsDb(options);
  const lines: string[] = [];
  const given: RequestDeps = {
    session: () => Promise.resolve(person === null ? null : db.as(person)),
    bearer: (authorization) => Promise.resolve(authorization === 'Bearer token' && options.bearer ? db.as(options.bearer) : null),
    service: requestsService(),
    log: (line) => { lines.push(line); },
  };
  return { deps: given, db, lines };
}

const post = (body: unknown) => new Request('http://galaxy.test/api/missions', { method: 'POST', body: JSON.stringify(body) });
const start = (extra: Record<string, unknown> = {}) => post({ workspace: NORTHWIND, fleet: 'night-shift', goal: 'Dark mode for quotes — à l\'écran ', ...extra });
const get = (authorization?: string) => new Request('http://galaxy.test/api/missions/requests/x', authorization === undefined ? {} : { headers: { authorization } });

describe('POST /api/missions', () => {
  it('AC-6: an owner\'s Start saves the goal word for word, the fleet and their login, and queues one job /omni:mission --request <id>', async () => {
    const { deps: given, db } = deps(ADA);
    const res = await makeRequest(start(), given);
    expect(res.status).toBe(201);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = await res.json() as { request: { id: string; job: string } };
    expect(body).toEqual({ request: { id: db.requests[0]?.id, repo: 'acme/shop', fleet: 'night-shift', goal: 'Dark mode for quotes — à l\'écran ', job: db.jobs[0]?.id } });
    expect(db.requests).toMatchObject([{ goal: 'Dark mode for quotes — à l\'écran ', fleet: 'night-shift', requestedBy: 'ada', mission: null }]);
    expect(db.jobs).toEqual([{ id: body.request.job, line: `/omni:mission --request ${body.request.id}`, repo: 'acme/shop', toFleet: 'night-shift', sentBy: ADA.id }]);
  });

  it('AC-6: a member who is not an owner, on a fleet below Works alone, is refused before anything is saved', async () => {
    const { deps: given, db } = deps(BEN);
    const res = await makeRequest(start(), given);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'A goal-only mission works alone: an owner starts it, or raises the fleet to Works alone.' });
    expect(db.requests).toEqual([]);
    expect(db.jobs).toEqual([]);
  });

  it('lets a member start one on a fleet that works alone, on the repository they name', async () => {
    const { deps: given, db } = deps(BEN);
    expect((await makeRequest(start({ fleet: 'day-shift', repo: 'acme/docs' }), given)).status).toBe(201);
    expect(db.jobs).toMatchObject([{ repo: 'acme/docs', toFleet: 'day-shift', sentBy: BEN.id }]);
  });

  it('refuses, saving nothing, a repository whose phase 0 is a pull request, and several repositories with none named', async () => {
    const { deps: given, db } = deps(ADA);
    const phase0 = await makeRequest(start({ repo: 'acme/plan' }), given);
    expect(phase0.status).toBe(409);
    expect(await phase0.json()).toEqual({ error: 'A goal-only mission needs phase 0 on the server.' });
    const several = await makeRequest(start({ fleet: 'day-shift' }), given);
    expect(several.status).toBe(409);
    expect(await several.json()).toEqual({ error: 'Repository: name the one the mission is written in, acme/docs or acme/shop.' });
    expect(db.requests).toEqual([]);
  });

  it('answers 404 for a fleet that is none, and 403 to a person of another workspace', async () => {
    expect((await makeRequest(start({ fleet: 'no-shift' }), deps(ADA).deps)).status).toBe(404);
    expect((await makeRequest(start(), deps(DAN).deps)).status).toBe(403);
  });

  it('answers 400 to a goal that is blank, over 300 characters or over two lines, and to a body that is none', async () => {
    const { deps: given, db } = deps(ADA);
    for (const goal of ['', '   ', 'a'.repeat(301), 'Dark mode\nfor quotes.']) expect((await makeRequest(start({ goal }), given)).status).toBe(400);
    expect((await makeRequest(start({ workspace: 'northwind' }), given)).status).toBe(400);
    expect((await makeRequest(start({ extra: true }), given)).status).toBe(400);
    expect((await makeRequest(new Request('http://galaxy.test/api/missions', { method: 'POST', body: 'not json' }), given)).status).toBe(400);
    expect(db.requests).toEqual([]);
  });

  it('takes a goal of 300 characters exactly', async () => {
    expect((await makeRequest(start({ goal: 'a'.repeat(300) }), deps(ADA).deps)).status).toBe(201);
  });

  it('answers 401 signed out, 503 with no database, and 500, logged, when the database fails', async () => {
    expect((await makeRequest(start(), deps(null).deps)).status).toBe(401);
    expect((await makeRequest(start(), { ...deps(ADA).deps, session: null })).status).toBe(503);
    const { deps: given, lines } = deps(ADA, { failing: true });
    const res = await makeRequest(start(), given);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'The mission could not be started. Try again.' });
    expect(lines).toEqual(['mission requests: connection reset']);
  });
});

describe('GET /api/missions/requests/<id>', () => {
  async function made(by = ADA) {
    const setup = deps(by, { bearer: BEN });
    await makeRequest(start(), setup.deps);
    return { ...setup, id: setup.db.requests[0]?.id ?? '' };
  }

  it('gives a member the goal word for word, the fleet, who pressed Start and the mission it became, null until pushed', async () => {
    const { deps: given, db, id } = await made();
    const res = await readRequest(id, get(), given);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ request: { id, repo: 'acme/shop', fleet: 'night-shift', goal: 'Dark mode for quotes — à l\'écran ', requestedBy: 'ada', mission: null, createdAt: '2027-01-29T10:00:00.000Z' } });
    db.pushed(id, 2901);
    expect(await (await readRequest(id, get(), given)).json()).toMatchObject({ request: { mission: 2901 } });
  });

  it('reads as the terminal\'s sign-in when a bearer is sent: a runner signs in as its owner, a member', async () => {
    const { deps: given, id } = await made();
    expect((await readRequest(id, get('Bearer token'), given)).status).toBe(200);
    expect((await readRequest(id, get('Bearer wrong'), given)).status).toBe(401);
  });

  it('tells a person of another workspace there is none, and refuses an id that is no uuid', async () => {
    const { db, id } = await made();
    const outsider: RequestDeps = { ...deps(DAN).deps, session: () => Promise.resolve(db.as(DAN)) };
    const res = await readRequest(id, get(), outsider);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: `No mission request ${id} you may read.` });
    expect((await readRequest('not-an-id', get(), deps(ADA).deps)).status).toBe(400);
  });

  it('answers 401 signed out and 503 with no database', async () => {
    expect((await readRequest('3f2a9c1e-7b4d-4e8a-9c2f-1a2b3c4d5e6f', get(), deps(null).deps)).status).toBe(401);
    expect((await readRequest('3f2a9c1e-7b4d-4e8a-9c2f-1a2b3c4d5e6f', get(), { ...deps(ADA).deps, bearer: null })).status).toBe(503);
  });
});
