import { describe, expect, it, vi } from 'vitest';
import type { PlanetDossier } from '../arcade/types';
import { PlanetDetailsSchema, planetDetailsPath, PlanetErrorSchema, type PlanetDetails } from './planet.contract';
import { planetHandlers, planetKeyOf } from './planet.controller';
import type { PlanetService, Served } from './planet.service';

vi.mock('server-only', () => ({}));

// One planet's details' route (PRD 1808), on a fake service:
//
//   GET /api/arcade/planets/<key> → 200 {dossier, log}
//
// The session is checked first: signed out, 401 and no service runs. A planet outside the workspace is
// 404, a failed read 500 and logged. The key is the path's last segment, read back whole.

const KEY = 'vertuoza/vertuo-omni-loop#12';
const DOSSIER: PlanetDossier = { id: 'd-12', url: '/prd/d-12', latest: { 'before-after': null, spec: { version: 2, at: '2026-09-25T08:00:00Z' }, plan: null }, asked: 3, answered: 2, last: [] };
const DETAILS: PlanetDetails = {
  dossier: DOSSIER,
  log: [{ at: '2026-09-26T10:00:00Z', type: 'zone', planet: 12, text: 'Ada secured api', contributor: 'ada', team: 'core' }],
};

const request = (key: string) => new Request(`https://omni.test${planetDetailsPath(key)}`);

function handlers(answer: Served<PlanetDetails> | null) {
  const asked: string[] = [];
  const failed: unknown[] = [];
  const service: PlanetService = { details: (key) => { asked.push(key); return Promise.resolve(answer ?? { ok: true, value: DETAILS }); } };
  const h = planetHandlers({ signedIn: () => Promise.resolve(answer === null ? null : service), failed: (e) => { failed.push(e); } });
  return { ...h, asked, failed };
}

describe('GET /api/arcade/planets/<key>', () => {
  it('answers the planet\'s dossier and log to a signed-in member, never cached', async () => {
    const { get, asked } = handlers({ ok: true, value: DETAILS });
    const answer = await get(request(KEY));
    expect(answer.status).toBe(200);
    expect(answer.headers.get('cache-control')).toBe('no-store');
    expect(PlanetDetailsSchema.parse(await answer.json())).toEqual(DETAILS);
    expect(asked).toEqual([KEY]);
  });

  it('answers none and unreadable dossiers as they are', async () => {
    for (const dossier of ['none', 'unreadable'] as const) {
      const answer = await handlers({ ok: true, value: { dossier, log: [] } }).get(request(KEY));
      expect(answer.status).toBe(200);
      expect(await answer.json()).toEqual({ dossier, log: [] });
    }
  });

  it('is 401 signed out, and runs no service', async () => {
    const { get, asked } = handlers(null);
    const answer = await get(request(KEY));
    expect(answer.status).toBe(401);
    expect(PlanetErrorSchema.parse(await answer.json()).error).toMatch(/sign in/i);
    expect(asked).toEqual([]);
  });

  it('is 404 for a planet outside the person\'s workspace', async () => {
    const answer = await handlers({ ok: false, kind: 'missing', error: 'No such planet in your galaxy.' }).get(request('acme/acme-plan#12'));
    expect(answer.status).toBe(404);
    expect(await answer.json()).toEqual({ error: 'No such planet in your galaxy.' });
  });

  it('is 500 when a read fails, and logs what was thrown', async () => {
    const boom = new Error('fake: ledger_events is out of reach');
    const { get, failed } = handlers({ ok: false, kind: 'database', error: 'The planet could not be read. Try again.', cause: boom });
    const answer = await get(request(KEY));
    expect(answer.status).toBe(500);
    expect(PlanetErrorSchema.parse(await answer.json()).error).toMatch(/could not be read/);
    expect(failed).toEqual([boom]);
  });

  it('is 404, and asks nothing, for a key that does not decode', async () => {
    const { get, asked } = handlers({ ok: true, value: DETAILS });
    expect((await get(new Request('https://omni.test/api/arcade/planets/%E0%A4%A'))).status).toBe(404);
    expect(asked).toEqual([]);
  });
});

describe('planetKeyOf', () => {
  it('reads a key holding a slash and a hash back whole, from one encoded segment', () => {
    expect(planetDetailsPath(KEY)).toBe('/api/arcade/planets/vertuoza%2Fvertuo-omni-loop%2312');
    expect(planetKeyOf(request(KEY))).toBe(KEY);
    expect(planetKeyOf(new Request('https://omni.test/api/arcade/planets/vertuoza%2Fvertuo-omni-loop%2312'))).toBe(KEY);
  });

  it('reads a planet keyed by its number alone, and none from an empty segment', () => {
    expect(planetKeyOf(request('12'))).toBe('12');
    expect(planetKeyOf(new Request('https://omni.test/api/arcade/planets/'))).toBeNull();
  });
});
