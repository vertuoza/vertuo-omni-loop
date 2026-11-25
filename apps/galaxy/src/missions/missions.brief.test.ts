import { describe, expect, it } from 'vitest';
import { readMissionBrief, readMissionsOfPrd, type MissionsDeps } from './missions.controller';
import { ADA, DAN, ELSEWHERE, fakeMissionsDb, PAUSED, RUNNING } from './missions.fake';
import { missionsService } from './missions.service';

// A member reads a mission's brief, its retros and which missions name a PRD from the terminal (PRD 3194), on the database in memory.
// Mission 42 (RUNNING) is acme/shop's; mission 45 (ELSEWHERE) belongs to another workspace.

const RECORD = '---\nmission: 42\n---\nA record, as pushed.\n';
const BRIEF = '<!doctype html><title>Pay online</title>\n';
const RETRO = {
  milestone: 'mission',
  retro: { wentWell: [{ text: 'PRD 7 merged.', cites: [{ kind: 'prd', ref: 7 }] }], toChange: [{ text: 'PRD 8 stalled.', cites: [{ kind: 'prd', ref: 8 }] }] },
  skipped: null,
  items: [{ number: 1, target: 'BR-PRODUCT-1', wording: 'Say it twice.', evidence: ['PRD 8 stalled.'], answer: null, note: null }],
};

/** The database in memory each served deps reads. */
const DBS = new WeakMap<MissionsDeps, ReturnType<typeof fakeMissionsDb>>();

function served(person: typeof ADA | null) {
  const db = fakeMissionsDb();
  db.pages.set(RUNNING, { record: RECORD, brief: BRIEF });
  db.retros.set(RUNNING, [RETRO]);
  db.scopes.set(RUNNING, [7, 8]);
  db.scopes.set(PAUSED, [8]);
  db.pages.set(ELSEWHERE, { record: 'other', brief: 'other' });
  db.scopes.set(ELSEWHERE, [7]);
  const deps: MissionsDeps = {
    session: null,
    service: missionsService(db.writer, { now: () => new Date('2027-01-22T10:00:00.000Z') }),
    bearer: (header) => Promise.resolve(header === null || person === null ? null : { caller: person, reader: db.reader(person) }),
    log: () => undefined,
  };
  DBS.set(deps, db);
  return deps;
}
const get = (path: string, authorization: string | null = 'Bearer t') =>
  new Request(`https://omni.example/api/missions/${path}`, { headers: authorization === null ? {} : { authorization } });

describe('GET /api/missions/brief', () => {
  it('answers a member the brief as pushed, byte for byte, and each retro as a file with its items as files, never cached', async () => {
    const res = await readMissionBrief(get('brief?repo=acme/shop&mission=42'), served(ADA));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({
      mission: 42, record: RECORD, brief: BRIEF,
      retros: [{
        k: 1, milestone: 'mission',
        content: '# Mission retro\n\n## What went well\n\n- PRD 7 merged. (PRD 7)\n\n## What to change\n\n- PRD 8 stalled. (PRD 8)\n',
        items: [{ name: '1.md', content: '# Item 1\n\n## Target\n\nBR-PRODUCT-1\n\n## Wording\n\nSay it twice.\n\n## Evidence\n\n- PRD 8 stalled.\n' }],
      }],
      open: [],
    });
  });

  it('bug #3286: answers the Architect\'s open points the PM has yet to answer, one entry per product PRD, none once the PM approved again', async () => {
    const A = 'a'.repeat(64);
    const B = 'b'.repeat(64);
    const deps = served(ADA);
    const db = DBS.get(deps);
    db?.decisions.set(RUNNING, [
      { kind: 'plan', prd: 'omni-loop-28', plan: A, outcome: 'approved', why: [] },
      { kind: 'tech', prd: 'omni-loop-28', plan: A, outcome: 'escalated', why: ['the PM must confirm the package'] },
      { kind: 'plan', prd: 'omni-loop-28', plan: null, outcome: 'escalated', why: ['no record of the plan approval'] },
      { kind: 'plan', prd: 'omni-loop-29', plan: A, outcome: 'approved', why: [] },
      { kind: 'tech', prd: 'omni-loop-29', plan: A, outcome: 'escalated', why: ['s5 is unclear'] },
      { kind: 'plan', prd: 'omni-loop-29', plan: B, outcome: 'approved', why: [] },
    ]);
    const res = await readMissionBrief(get('brief?repo=acme/shop&mission=42'), deps);
    expect((await res.json() as { open: unknown }).open).toEqual([{ prd: 'omni-loop-28', plan: A, points: ['the PM must confirm the package'] }]);
  });

  it('AC-6: answers 404 to another workspace\'s member and to a mission that does not exist', async () => {
    expect((await readMissionBrief(get('brief?repo=other/repo&mission=45'), served(ADA))).status).toBe(404);
    expect((await readMissionBrief(get('brief?repo=acme/shop&mission=42'), served(DAN))).status).toBe(404);
    expect((await readMissionBrief(get('brief?repo=acme/shop&mission=999'), served(ADA))).status).toBe(404);
    expect((await readMissionBrief(get('brief?repo=acme/shop&mission=43'), served(ADA))).status).toBe(404);
  });

  it('answers 401 with no token, 400 to a query that is none, 503 with no database', async () => {
    expect((await readMissionBrief(get('brief?repo=acme/shop&mission=42', null), served(ADA))).status).toBe(401);
    expect((await readMissionBrief(get('brief?repo=nope&mission=42'), served(ADA))).status).toBe(400);
    expect((await readMissionBrief(get('brief?repo=acme/shop'), served(ADA))).status).toBe(400);
    expect((await readMissionBrief(get('brief?repo=acme/shop&mission=42'), { session: null, service: null, bearer: null, log: () => undefined })).status).toBe(503);
  });
});

describe('GET /api/missions/of-prd', () => {
  it('answers the numbers of the missions whose brief names the PRD, and an empty list when none does', async () => {
    expect(await (await readMissionsOfPrd(get('of-prd?repo=acme/shop&prd=8'), served(ADA))).json()).toEqual({ missions: [42, 43] });
    expect(await (await readMissionsOfPrd(get('of-prd?repo=acme/shop&prd=7'), served(ADA))).json()).toEqual({ missions: [42] });
    expect(await (await readMissionsOfPrd(get('of-prd?repo=acme/shop&prd=99'), served(ADA))).json()).toEqual({ missions: [] });
  });

  it('AC-6: shows another workspace\'s mission to nobody, so it reads as no mission', async () => {
    expect(await (await readMissionsOfPrd(get('of-prd?repo=other/repo&prd=7'), served(ADA))).json()).toEqual({ missions: [] });
    expect(await (await readMissionsOfPrd(get('of-prd?repo=acme/shop&prd=8'), served(DAN))).json()).toEqual({ missions: [] });
  });

  it('answers 401 with no token and 400 to a query that is none', async () => {
    expect((await readMissionsOfPrd(get('of-prd?repo=acme/shop&prd=8', null), served(ADA))).status).toBe(401);
    expect((await readMissionsOfPrd(get('of-prd?repo=acme/shop&prd=x'), served(ADA))).status).toBe(400);
  });
});
